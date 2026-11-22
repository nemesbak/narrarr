"""Narrarr: API REST (FastAPI) + SPA estática."""
import asyncio
import logging
import os
import shutil
from collections import deque
from contextlib import asynccontextmanager
from logging.handlers import RotatingFileHandler

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import config, db, downloader, indexers, library, metadata, notify, scheduler, scoring

# ---------------- registro ----------------
os.makedirs(config.RUTA_CONFIG, exist_ok=True)
_fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s", "%Y-%m-%d %H:%M:%S")
_raiz = logging.getLogger("narrarr")
_raiz.setLevel(logging.INFO)
if not _raiz.handlers:
    _fh = RotatingFileHandler(config.RUTA_LOG, maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    _fh.setFormatter(_fmt)
    _sh = logging.StreamHandler()
    _sh.setFormatter(_fmt)
    _raiz.addHandler(_fh)
    _raiz.addHandler(_sh)
log = logging.getLogger("narrarr")

ESTADOS_LIBRO = ("deseado", "buscando", "descargando", "descargado", "ignorado")
CAMPOS_EDITABLES = ("asin", "titulo", "subtitulo", "autor", "narrador", "serie", "serie_pos", "anio",
                    "duracion_min", "idioma", "sinopsis", "portada_url", "estado", "ruta")
STATIC = os.path.join(os.path.dirname(__file__), "static")


@asynccontextmanager
async def ciclo(_app):
    db.iniciar()
    log.info("Narrarr %s arrancado (biblioteca: %s)", config.VERSION, config.obtener("ruta_biblioteca"))
    tarea = asyncio.create_task(scheduler.bucle())
    yield
    tarea.cancel()


app = FastAPI(title="Narrarr", version=config.VERSION, lifespan=ciclo, docs_url="/api/docs", openapi_url="/api/openapi.json")


def error(codigo: int, mensaje: str):
    raise HTTPException(status_code=codigo, detail=mensaje)


@app.exception_handler(StarletteHTTPException)
async def _http_error(_req, exc):
    return JSONResponse({"detalle": str(exc.detail)}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def _validacion(_req, exc):
    campos = ", ".join(".".join(str(x) for x in e.get("loc", [])[1:]) for e in exc.errors())
    return JSONResponse({"detalle": f"Datos no válidos: {campos or 'revisa la petición'}"}, status_code=422)


@app.exception_handler(Exception)
async def _inesperado(_req, exc):
    log.exception("Error inesperado: %s", exc)
    return JSONResponse({"detalle": f"Error interno: {exc}"}, status_code=500)


# ---------------- estado ----------------

async def _probar(servicio: str) -> tuple[bool, str]:
    try:
        if servicio == "prowlarr":
            import httpx
            url, clave = config.obtener("prowlarr_url"), config.obtener("prowlarr_key")
            if not url or not clave:
                return False, "Prowlarr no está configurado"
            async with httpx.AsyncClient(timeout=10) as cli:
                r = await cli.get(f"{url}/api/v1/system/status", headers={"X-Api-Key": clave})
            if r.status_code == 200:
                return True, f"Conectado a Prowlarr {r.json().get('version', '')}".strip()
            if r.status_code == 401:
                return False, "Prowlarr rechaza la clave API (401)"
            return False, f"Prowlarr respondió con error {r.status_code}"
        if servicio == "qbit":
            async with downloader.QBit() as q:
                return True, f"Conectado a qBittorrent {await q.version()}"
        if servicio == "telegram":
            return await notify.telegram("✅ Prueba de conexión desde <b>Narrarr</b>")
        if servicio in ("jellyfin", "emby"):
            return await notify.probar_servidor(servicio)
    except Exception as e:  # noqa: BLE001
        msg = str(e) or e.__class__.__name__
        if "connect" in msg.lower() or e.__class__.__name__.startswith("Connect"):
            msg = f"No se puede conectar: {msg}"
        return False, msg
    return False, "Servicio desconocido"


def _configurado(servicio: str) -> bool:
    return bool(config.obtener({"qbit": "qbit_url"}.get(servicio, f"{servicio}_url")))


@app.get("/api/estado")
async def estado():
    servicios = ["prowlarr", "qbit", "jellyfin", "emby"]
    resultados = await asyncio.gather(*[_probar(s) if _configurado(s) else asyncio.sleep(0, (False, "No configurado"))
                                        for s in servicios])
    conexiones = {s: {"ok": ok, "configurado": _configurado(s), "mensaje": m} for s, (ok, m) in zip(servicios, resultados)}
    cuentas = {e: 0 for e in ESTADOS_LIBRO}
    for f in db.consultar("SELECT estado, COUNT(*) n FROM libros GROUP BY estado"):
        cuentas[f["estado"]] = f["n"]
    ruta = config.obtener("ruta_biblioteca")
    try:
        uso = shutil.disk_usage(ruta)
        espacio = {"ruta": ruta, "libre": uso.free, "total": uso.total}
    except OSError:
        espacio = {"ruta": ruta, "libre": None, "total": None}
    return {"version": config.VERSION, "conexiones": conexiones, "libros": cuentas,
            "total_libros": sum(cuentas.values()), "espacio": espacio, "proxima_tarea": scheduler.proxima()}


# ---------------- libros ----------------

ORDENES = {"titulo": "titulo COLLATE NOCASE", "autor": "autor COLLATE NOCASE, serie, serie_pos, titulo",
           "añadido": '"añadido" DESC', "duracion": "duracion_min DESC"}


@app.get("/api/libros")
async def libros(estado: str | None = None, q: str | None = None, orden: str = "titulo"):
    sql, params = "SELECT * FROM libros WHERE 1=1", []
    if estado:
        estados = [e for e in estado.split(",") if e]
        sql += f" AND estado IN ({','.join('?' * len(estados))})"
        params += estados
    if q:
        sql += " AND (titulo LIKE ? OR autor LIKE ? OR narrador LIKE ? OR serie LIKE ?)"
        params += [f"%{q}%"] * 4
    sql += " ORDER BY " + ORDENES.get(orden, ORDENES["titulo"])
    return db.consultar(sql, params)


def _libro_o_404(id_: int) -> dict:
    l = db.uno("SELECT * FROM libros WHERE id=?", (id_,))
    if not l:
        error(404, "Libro no encontrado")
    return l


@app.get("/api/libros/{id_}")
async def libro(id_: int):
    l = _libro_o_404(id_)
    l["descargas"] = db.consultar("SELECT * FROM descargas WHERE libro_id=? ORDER BY id DESC", (id_,))
    l["historial"] = db.consultar("SELECT * FROM historial WHERE libro_id=? ORDER BY id DESC LIMIT 100", (id_,))
    archivos = []
    if l.get("ruta") and os.path.isdir(l["ruta"]):
        for n in sorted(os.listdir(l["ruta"]), key=library.clave_orden):
            p = os.path.join(l["ruta"], n)
            if os.path.isfile(p):
                archivos.append({"nombre": n, "tamano": os.path.getsize(p)})
    l["archivos"] = archivos
    return l


@app.post("/api/libros", status_code=201)
async def anadir_libro(datos: dict = Body(...)):
    buscar_ya = bool(datos.get("buscar_ya"))
    if datos.get("asin"):
        if db.uno("SELECT id FROM libros WHERE asin=?", (datos["asin"],)):
            error(409, "Ese libro ya está en la biblioteca")
        m = await metadata.ficha(datos["asin"])
        if not m:
            error(404, "No se encontró ese ASIN en Audible")
        fila = metadata.a_libro(m)
    elif datos.get("titulo"):
        fila = {"titulo": datos["titulo"].strip(), "autor": (datos.get("autor") or "").strip(),
                "narrador": (datos.get("narrador") or "").strip()}
    else:
        error(400, "Indica un asin o un título")
    fila.update({"estado": "deseado", "añadido": db.ahora(), "actualizado": db.ahora()})
    lid = db.insertar("libros", fila)
    db.historial("buscado", f"Añadido a deseados: {fila['titulo']}", lid)
    if buscar_ya:
        asyncio.get_running_loop().create_task(_buscar_uno(lid))
    return _libro_o_404(lid)


async def _buscar_uno(lid: int):
    try:
        l = db.uno("SELECT * FROM libros WHERE id=?", (lid,))
        if l:
            await scheduler.buscar_y_capturar(l)
    except Exception as e:  # noqa: BLE001
        log.warning("Búsqueda inmediata fallida: %s", e)


@app.patch("/api/libros/{id_}")
async def editar_libro(id_: int, datos: dict = Body(...)):
    _libro_o_404(id_)
    cambios = {k: v for k, v in datos.items() if k in CAMPOS_EDITABLES}
    if "estado" in cambios and cambios["estado"] not in ESTADOS_LIBRO:
        error(400, f"Estado no válido; usa uno de: {', '.join(ESTADOS_LIBRO)}")
    if cambios:
        cambios["actualizado"] = db.ahora()
        db.actualizar("libros", id_, cambios)
    return _libro_o_404(id_)


@app.delete("/api/libros/{id_}")
async def borrar_libro(id_: int, borrar_archivos: bool = False):
    l = _libro_o_404(id_)
    if borrar_archivos and l.get("ruta"):
        raiz = os.path.realpath(config.obtener("ruta_biblioteca"))
        ruta = os.path.realpath(l["ruta"])
        if not ruta.startswith(raiz + os.sep):
            error(400, "La ruta del libro está fuera de la biblioteca; no se borra nada")
        await asyncio.to_thread(shutil.rmtree, ruta, True)
    db.ejecutar("DELETE FROM libros WHERE id=?", (id_,))
    try:
        os.remove(os.path.join(config.RUTA_PORTADAS, f"{id_}.jpg"))
    except OSError:
        pass
    db.historial("borrado", f"Quitado «{l['titulo']}»" + (" y borrados sus archivos" if borrar_archivos else ""), id_)
    return {"ok": True}


@app.get("/api/portada/{id_}")
async def portada(id_: int):
    l = _libro_o_404(id_)
    ruta = await library.ruta_portada(l)
    if ruta:
        return FileResponse(ruta, headers={"Cache-Control": "public, max-age=86400"})
    return Response(library.svg_iniciales(l["titulo"]), media_type="image/svg+xml")


# ---------------- metadatos ----------------

def _en_biblioteca(m: dict) -> bool:
    return bool(m.get("asin") and db.uno("SELECT id FROM libros WHERE asin=?", (m["asin"],)))


@app.get("/api/metadatos/buscar")
async def buscar_metadatos(q: str):
    if not q.strip():
        error(400, "Escribe algo para buscar")
    res = await metadata.buscar(q.strip())
    for m in res:
        m["en_biblioteca"] = _en_biblioteca(m)
        m.pop("autores_asin", None)
    return res


@app.get("/api/metadatos/autor")
async def metadatos_autor(nombre: str):
    """Todo lo que hay de un autor en Audible (para «pinchar en el autor» desde Añadir)."""
    if not nombre.strip():
        error(400, "Falta el nombre del autor")
    nombre = nombre.strip()
    propios = {l["asin"]: l for l in db.consultar("SELECT id, asin, estado FROM libros WHERE asin IS NOT NULL")}
    libros = []
    for m in await metadata.buscar_autor(nombre):
        if scoring.normalizar(nombre) not in scoring.normalizar(" ".join(m["autores"])):
            continue
        m.pop("autores_asin", None)
        l = propios.get(m["asin"])
        m["en_biblioteca"] = bool(l) or _en_biblioteca(m)
        m["libro_id"] = l["id"] if l else None
        m["estado"] = l["estado"] if l else None
        libros.append(m)
    a = db.uno("SELECT * FROM autores WHERE nombre = ?", (nombre,))
    return {"nombre": nombre, "autor_id": a["id"] if a else None, "vigilado": bool(a and a.get("vigilado")), "libros": libros}


# ---------------- autores ----------------

@app.get("/api/autores")
async def autores():
    res = db.consultar("SELECT * FROM autores ORDER BY nombre COLLATE NOCASE")
    for a in res:
        a["vigilado"] = bool(a["vigilado"])
        a["libros"] = db.uno("SELECT COUNT(*) n FROM libros WHERE autor LIKE ?", (f"%{a['nombre']}%",))["n"]
    return res


@app.post("/api/autores", status_code=201)
async def anadir_autor(datos: dict = Body(...)):
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        error(400, "Indica el nombre del autor")
    if db.uno("SELECT id FROM autores WHERE nombre=? COLLATE NOCASE", (nombre,)):
        error(409, "Ese autor ya está añadido")
    asin = None
    for m in await metadata.buscar_autor(nombre):
        for n, a in zip(m.get("autores") or [], m.get("autores_asin") or []):
            if n.lower() == nombre.lower() and a:
                asin = a
                break
        if asin:
            break
    aid = db.insertar("autores", {"nombre": nombre, "asin": asin, "vigilado": 1 if datos.get("vigilado") else 0,
                                  "añadido": db.ahora()})
    a = db.uno("SELECT * FROM autores WHERE id=?", (aid,))
    a["vigilado"] = bool(a["vigilado"])
    return a


def _autor_o_404(id_: int) -> dict:
    a = db.uno("SELECT * FROM autores WHERE id=?", (id_,))
    if not a:
        error(404, "Autor no encontrado")
    a["vigilado"] = bool(a["vigilado"])
    return a


@app.get("/api/autores/{id_}")
async def autor(id_: int):
    a = _autor_o_404(id_)
    propios = db.consultar("SELECT * FROM libros WHERE autor LIKE ? ORDER BY serie, serie_pos, anio", (f"%{a['nombre']}%",))
    por_asin = {l["asin"]: l for l in propios if l.get("asin")}
    catalogo = []
    for m in await metadata.buscar_autor(a["nombre"]):
        if a["nombre"].lower() not in " ".join(m["autores"]).lower():
            continue
        m.pop("autores_asin", None)
        l = por_asin.get(m["asin"])
        m["en_biblioteca"] = bool(l)
        m["libro_id"] = l["id"] if l else None
        m["estado"] = l["estado"] if l else None
        catalogo.append(m)
    a["libros"] = propios
    a["catalogo"] = catalogo
    return a


@app.patch("/api/autores/{id_}")
async def editar_autor(id_: int, datos: dict = Body(...)):
    _autor_o_404(id_)
    cambios = {}
    if "vigilado" in datos:
        cambios["vigilado"] = 1 if datos["vigilado"] else 0
    for k in ("nombre", "foto_url", "asin"):
        if k in datos:
            cambios[k] = datos[k]
    db.actualizar("autores", id_, cambios)
    return _autor_o_404(id_)


@app.delete("/api/autores/{id_}")
async def borrar_autor(id_: int):
    _autor_o_404(id_)
    db.ejecutar("DELETE FROM autores WHERE id=?", (id_,))
    return {"ok": True}


# ---------------- lanzamientos ----------------

@app.get("/api/lanzamientos")
async def lanzamientos(libro_id: int | None = None, q: str | None = None):
    try:
        if libro_id:
            l = _libro_o_404(libro_id)
            res = await indexers.buscar_libro(l)
            db.actualizar("libros", libro_id, {"ultima_busqueda": db.ahora()})
            db.historial("buscado", f"Búsqueda interactiva de «{l['titulo']}»: {len(res)} resultados", libro_id)
        elif q:
            res = indexers.puntuar_lista(await indexers.buscar_prowlarr(q), q, "")
        else:
            error(400, "Indica libro_id o q")
    except indexers.ErrorIndexador as e:
        error(502, str(e))
    return res


@app.post("/api/lanzamientos/capturar")
async def capturar(datos: dict = Body(...)):
    if not datos.get("libro_id"):
        error(400, "Falta libro_id")
    _libro_o_404(int(datos["libro_id"]))
    try:
        return await scheduler.capturar_lanzamiento(
            int(datos["libro_id"]), datos.get("url_descarga") or "", datos.get("titulo") or "",
            datos.get("indexador") or "", int(datos.get("tamano") or 0))
    except (downloader.ErrorDescarga, ValueError) as e:
        error(502, str(e))


# ---------------- descargas ----------------

@app.get("/api/descargas")
async def descargas():
    filas = db.consultar(
        "SELECT d.*, l.titulo AS libro_titulo, l.autor AS libro_autor FROM descargas d "
        "LEFT JOIN libros l ON l.id=d.libro_id WHERE d.estado IN ('en_cola','descargando','completada','fallida') "
        "ORDER BY d.id DESC LIMIT 200")
    activos = [f for f in filas if f["estado"] in ("en_cola", "descargando", "completada") and f["hash"]]
    if activos:
        try:
            async with downloader.QBit() as q:
                t = {x["hash"].lower(): x for x in await q.torrents(hashes="|".join(f["hash"] for f in activos))}
            for f in filas:
                x = t.get((f["hash"] or "").lower())
                if x:
                    f.update({"progreso": round(float(x.get("progress") or 0) * 100, 1), "estado_qbit": x.get("state"),
                              "velocidad": x.get("dlspeed"), "eta": x.get("eta"), "semillas": x.get("num_seeds")})
        except Exception as e:  # noqa: BLE001
            for f in filas:
                f["aviso"] = f"Sin datos en vivo de qBittorrent: {e}"
    return filas


@app.delete("/api/descargas/{id_}")
async def borrar_descarga(id_: int, borrar_datos: bool = False):
    d = db.uno("SELECT * FROM descargas WHERE id=?", (id_,))
    if not d:
        error(404, "Descarga no encontrada")
    aviso = None
    if d["hash"] and d["estado"] != "importada":
        try:
            async with downloader.QBit() as q:
                await q.borrar(d["hash"], borrar_datos)
        except Exception as e:  # noqa: BLE001
            aviso = f"No se pudo quitar de qBittorrent: {e}"
    db.ejecutar("DELETE FROM descargas WHERE id=?", (id_,))
    l = db.uno("SELECT * FROM libros WHERE id=?", (d["libro_id"],))
    if l and l["estado"] in ("descargando", "buscando"):
        db.actualizar("libros", l["id"], {"estado": "deseado"})
    db.historial("borrado", f"Descarga quitada: {d['titulo_release']}", d["libro_id"])
    return {"ok": True, "aviso": aviso}


@app.post("/api/descargas/{id_}/importar")
async def importar_descarga(id_: int, datos: dict | None = Body(None)):
    from . import importer
    d = db.uno("SELECT * FROM descargas WHERE id=?", (id_,))
    if not d:
        error(404, "Descarga no encontrada")
    ruta = (datos or {}).get("ruta")
    if not ruta and not d.get("ruta_origen") and d.get("hash"):
        try:
            async with downloader.QBit() as q:
                t = await q.torrents(hashes=d["hash"])
            if t:
                ruta = downloader.ruta_local(t[0].get("content_path") or t[0].get("save_path"))
        except Exception as e:  # noqa: BLE001
            error(502, str(e))
    try:
        return await importer.importar(id_, ruta)
    except (FileNotFoundError, ValueError, OSError) as e:
        error(400, str(e))


# ---------------- historial, ajustes, tareas, sistema ----------------

@app.get("/api/historial")
async def ver_historial(limite: int = 100):
    return db.consultar(
        "SELECT h.*, l.titulo AS libro_titulo FROM historial h LEFT JOIN libros l ON l.id=h.libro_id "
        "ORDER BY h.id DESC LIMIT ?", (max(1, min(limite, 2000)),))


@app.get("/api/ajustes")
async def ver_ajustes():
    return config.enmascarados()


@app.put("/api/ajustes")
async def guardar_ajustes(datos: dict = Body(...)):
    config.guardar(datos)
    return config.enmascarados()


@app.post("/api/ajustes/probar/{servicio}")
async def probar(servicio: str):
    if servicio not in ("prowlarr", "qbit", "telegram", "jellyfin", "emby"):
        error(404, "Servicio desconocido")
    ok, mensaje = await _probar(servicio)
    return {"ok": ok, "mensaje": mensaje}


@app.get("/api/tareas")
async def tareas():
    return scheduler.listado()


@app.post("/api/tareas/{nombre}")
async def lanzar_tarea(nombre: str):
    if nombre not in scheduler.TAREAS:
        error(404, "Tarea desconocida")
    if scheduler.TAREAS[nombre]["ejecutando"]:
        return {"ok": False, "mensaje": "La tarea ya se está ejecutando"}
    scheduler.lanzar(nombre)
    return {"ok": True, "mensaje": f"Tarea «{scheduler.TAREAS[nombre]['nombre']}» lanzada"}


@app.get("/api/sistema/log")
async def ver_log(lineas: int = 200):
    if not os.path.exists(config.RUTA_LOG):
        return {"lineas": []}
    with open(config.RUTA_LOG, encoding="utf-8", errors="replace") as fh:
        return {"lineas": [l.rstrip("\n") for l in deque(fh, maxlen=max(1, min(lineas, 5000)))]}


@app.api_route("/api/{resto:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def api_404(resto: str):
    error(404, f"Ruta de la API desconocida: /api/{resto}")


# ---------------- SPA estática ----------------

@app.get("/{ruta:path}", include_in_schema=False)
async def spa(ruta: str, request: Request):
    base = os.path.realpath(STATIC)
    destino = os.path.realpath(os.path.join(base, ruta)) if ruta else ""
    if destino.startswith(base + os.sep) and os.path.isfile(destino):
        return FileResponse(destino)
    indice = os.path.join(base, "index.html")
    if os.path.isfile(indice):
        return FileResponse(indice, headers={"Cache-Control": "no-cache"})
    return JSONResponse({"detalle": "Interfaz no disponible (falta static/index.html)"}, status_code=404)
