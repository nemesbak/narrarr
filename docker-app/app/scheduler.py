"""Planificador con asyncio: tareas periódicas con freno para no saturar los trackers privados."""
import asyncio
import logging
from datetime import datetime, timedelta

from . import config, db, downloader, importer, indexers, library, metadata

log = logging.getLogger("narrarr.planificador")

ESTADOS_SEMBRANDO = {"uploading", "stalledUP", "pausedUP", "stoppedUP", "queuedUP", "forcedUP", "checkingUP"}

TAREAS: dict[str, dict] = {
    "comprobar_descargas": {"nombre": "Comprobar descargas", "ajuste": "intervalo_comprobar_descargas"},
    "buscar_deseados": {"nombre": "Buscar deseados", "ajuste": "intervalo_buscar_deseados"},
    "escanear_biblioteca": {"nombre": "Escanear biblioteca", "ajuste": "intervalo_escanear_biblioteca"},
    "vigilar_autores": {"nombre": "Vigilar autores", "ajuste": "intervalo_vigilar_autores"},
}
for _t in TAREAS.values():
    _t.update({"ultimo": None, "proximo": None, "ejecutando": False, "resultado": None})

_cerrojos = {k: asyncio.Lock() for k in TAREAS}


# ---------------- acciones compartidas con la API ----------------

async def capturar_lanzamiento(libro_id: int, url_descarga: str, titulo: str,
                               indexador: str = "", tamano: int = 0) -> dict:
    libro = db.uno("SELECT * FROM libros WHERE id=?", (libro_id,))
    if not libro:
        raise ValueError("El libro no existe")
    try:
        h = await downloader.capturar(url_descarga)
    except Exception as e:
        db.historial("fallo", f"No se pudo capturar «{titulo}»: {e}", libro_id)
        raise
    previa = db.uno("SELECT id FROM descargas WHERE hash=? AND estado NOT IN ('importada','fallida')", (h,))
    if previa:
        did = previa["id"]
    else:
        did = db.insertar("descargas", {
            "libro_id": libro_id, "hash": h, "titulo_release": titulo, "indexador": indexador,
            "tamano": tamano or 0, "progreso": 0, "estado": "en_cola", "añadido": db.ahora()})
    db.actualizar("libros", libro_id, {"estado": "descargando", "actualizado": db.ahora()})
    db.historial("capturado", f"Enviado a qBittorrent: {titulo} ({indexador or 'indexador desconocido'})", libro_id)
    return {"id": did, "hash": h}


async def buscar_y_capturar(libro: dict) -> str:
    """Busca un libro y, si hay un lanzamiento aceptable, lo captura. Devuelve un resumen."""
    db.actualizar("libros", libro["id"], {"ultima_busqueda": db.ahora(), "estado": "buscando"})
    try:
        res = await indexers.buscar_libro(libro)
    except Exception as e:
        db.actualizar("libros", libro["id"], {"estado": "deseado"})
        db.historial("fallo", f"Búsqueda fallida de «{libro['titulo']}»: {e}", libro["id"])
        raise
    validos = [r for r in res if not r["rechazado"] and r["puntuacion"] >= (config.obtener("puntuacion_minima") or 0)]
    if not validos:
        db.actualizar("libros", libro["id"], {"estado": "deseado"})
        db.historial("buscado", f"Buscado «{libro['titulo']}»: {len(res)} resultados, ninguno aceptable", libro["id"])
        return "sin resultados aceptables"
    mejor = validos[0]
    db.historial("buscado", f"Buscado «{libro['titulo']}»: mejor «{mejor['titulo']}» ({mejor['puntuacion']} puntos)", libro["id"])
    if not config.obtener("captura_automatica"):
        db.actualizar("libros", libro["id"], {"estado": "deseado"})
        return "encontrado (captura automática desactivada)"
    try:
        await capturar_lanzamiento(libro["id"], mejor["url_descarga"], mejor["titulo"], mejor["indexador"], mejor["tamano"])
    except Exception:
        db.actualizar("libros", libro["id"], {"estado": "deseado"})
        raise
    return "capturado"


# ---------------- tareas ----------------

async def comprobar_descargas() -> str:
    activas = db.consultar("SELECT * FROM descargas WHERE estado IN ('en_cola','descargando','completada')")
    if not activas:
        return "No hay descargas activas"
    async with downloader.QBit() as q:
        torrents = {t["hash"].lower(): t for t in await q.torrents(hashes="|".join(d["hash"] for d in activas if d["hash"]))}
    importadas = 0
    for d in activas:
        t = torrents.get((d["hash"] or "").lower())
        if not t:
            db.actualizar("descargas", d["id"], {"estado": "fallida", "error": "El torrent ya no está en qBittorrent"})
            db.historial("fallo", f"«{d['titulo_release']}» desapareció de qBittorrent", d["libro_id"])
            libro = db.uno("SELECT estado FROM libros WHERE id=?", (d["libro_id"],))
            if libro and libro["estado"] == "descargando":
                db.actualizar("libros", d["libro_id"], {"estado": "deseado"})
            continue
        progreso = float(t.get("progress") or 0)
        cambios = {"progreso": round(progreso * 100, 1), "tamano": t.get("total_size") or t.get("size") or d["tamano"]}
        terminado = progreso >= 1 and t.get("state") in ESTADOS_SEMBRANDO
        if t.get("state") in ("error", "missingFiles"):
            cambios.update({"estado": "fallida", "error": f"qBittorrent informa del estado «{t.get('state')}»"})
        elif terminado:
            ruta = t.get("content_path") or t.get("save_path") or ""
            cambios.update({"estado": "completada", "ruta_origen": downloader.ruta_local(ruta)})
        else:
            cambios["estado"] = "descargando" if progreso > 0 else "en_cola"
        db.actualizar("descargas", d["id"], cambios)
        if terminado:
            try:
                await importer.importar(d["id"])
                importadas += 1
            except Exception as e:  # noqa: BLE001
                log.warning("Importación fallida de %s: %s", d["titulo_release"], e)
    return f"{len(activas)} descargas revisadas, {importadas} importadas"


async def buscar_deseados() -> str:
    """Con freno: máx. N libros por pasada, pausa entre búsquedas y cada libro como mucho 1 vez cada X h."""
    aj = config.todos()
    limite = datetime.now() - timedelta(hours=aj["freno_horas_por_libro"])
    candidatos = db.consultar(
        "SELECT * FROM libros WHERE estado='deseado' AND (ultima_busqueda IS NULL OR ultima_busqueda < ?) "
        "ORDER BY ultima_busqueda IS NOT NULL, ultima_busqueda, id LIMIT ?",
        (limite.isoformat(timespec="seconds"), aj["freno_max_libros"]))
    if not candidatos:
        return "Ningún deseado pendiente de buscar"
    capturados = 0
    for i, libro in enumerate(candidatos):
        if i:
            await asyncio.sleep(aj["freno_pausa_segundos"])
        try:
            if await buscar_y_capturar(libro) == "capturado":
                capturados += 1
        except Exception as e:  # noqa: BLE001
            log.warning("Búsqueda de %s fallida: %s", libro["titulo"], e)
            if isinstance(e, indexers.ErrorIndexador):
                break  # Prowlarr caído: no seguir martilleando
    return f"{len(candidatos)} libros buscados, {capturados} capturados"


async def escanear_biblioteca() -> str:
    r = await library.escanear()
    return f"{r['nuevos']} nuevos, {r['actualizados']} actualizados"


async def vigilar_autores() -> str:
    autores = db.consultar("SELECT * FROM autores WHERE vigilado=1")
    nuevos = 0
    for a in autores:
        for m in await metadata.buscar_autor(a["nombre"]):
            if not m.get("asin") or a["nombre"].lower() not in " ".join(m["autores"]).lower():
                continue
            if db.uno("SELECT id FROM libros WHERE asin=?", (m["asin"],)):
                continue
            fila = metadata.a_libro(m)
            fila.update({"estado": "deseado", "añadido": db.ahora(), "actualizado": db.ahora()})
            lid = db.insertar("libros", fila)
            db.historial("buscado", f"Nuevo libro de {a['nombre']} añadido a deseados: {m['titulo']}", lid)
            nuevos += 1
        await asyncio.sleep(2)
    return f"{len(autores)} autores vigilados, {nuevos} libros nuevos en deseados"


FUNCIONES = {
    "comprobar_descargas": comprobar_descargas,
    "buscar_deseados": buscar_deseados,
    "escanear_biblioteca": escanear_biblioteca,
    "vigilar_autores": vigilar_autores,
}


async def ejecutar(nombre: str) -> str:
    """Ejecuta una tarea capturando cualquier error (nunca tumba el planificador)."""
    t = TAREAS[nombre]
    if _cerrojos[nombre].locked():
        return "La tarea ya se está ejecutando"
    async with _cerrojos[nombre]:
        t["ejecutando"] = True
        try:
            res = await FUNCIONES[nombre]()
            if nombre != "comprobar_descargas" or "importadas" in res and not res.endswith(" 0 importadas"):
                log.info("%s: %s", t["nombre"], res)
        except Exception as e:  # noqa: BLE001
            res = f"Error: {e}"
            if nombre != "comprobar_descargas":
                log.warning("%s falló: %s", t["nombre"], e)
        finally:
            t["ejecutando"] = False
        t["ultimo"] = db.ahora()
        t["resultado"] = res
        return res


def lanzar(nombre: str) -> None:
    asyncio.get_running_loop().create_task(ejecutar(nombre))


async def bucle() -> None:
    """Bucle principal: cada 15 s mira qué tareas tocan."""
    ahora = datetime.now()
    retrasos = {"comprobar_descargas": 0.5, "escanear_biblioteca": 1, "vigilar_autores": 5, "buscar_deseados": 10}
    for k, t in TAREAS.items():
        t["proximo"] = (ahora + timedelta(minutes=retrasos[k])).isoformat(timespec="seconds")
    while True:
        try:
            ahora = datetime.now()
            for k, t in TAREAS.items():
                if t["proximo"] and datetime.fromisoformat(t["proximo"]) <= ahora and not t["ejecutando"]:
                    minutos = max(1, int(config.obtener(t["ajuste"]) or 60))
                    t["proximo"] = (ahora + timedelta(minutes=minutos)).isoformat(timespec="seconds")
                    lanzar(k)
        except Exception as e:  # noqa: BLE001
            log.error("Error en el planificador: %s", e)
        await asyncio.sleep(15)


def listado() -> list[dict]:
    return [{"id": k, "nombre": t["nombre"], "ultimo": t["ultimo"], "proximo": t["proximo"],
             "ejecutando": t["ejecutando"], "resultado": t["resultado"],
             "intervalo_min": config.obtener(t["ajuste"])} for k, t in TAREAS.items()]


def proxima() -> dict | None:
    l = [x for x in listado() if x["proximo"]]
    return min(l, key=lambda x: x["proximo"]) if l else None
