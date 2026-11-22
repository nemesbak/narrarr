"""Biblioteca en disco: rutas saneadas, portadas, duración y escaneo."""
import asyncio
import html
import logging
import os
import re

import httpx

from . import config, db, metadata, scoring

log = logging.getLogger("narrarr.biblioteca")

EXT_AUDIO = {".m4b", ".m4a", ".mp3", ".flac", ".ogg", ".opus", ".aac", ".wma"}
INVALIDOS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def sanear(nombre: str | None, defecto: str = "Desconocido") -> str:
    """Quita caracteres no válidos en rutas (Windows/SMB incluidos) y puntos/espacios finales."""
    n = INVALIDOS.sub("", (nombre or "").replace("/", "-").replace(":", " -"))
    n = re.sub(r"\s+", " ", n).strip().rstrip(". ")
    return n[:150] or defecto


def biblioteca() -> str:
    return config.obtener("ruta_biblioteca") or "/audiolibros"


def carpeta_destino(libro: dict) -> str:
    autor = sanear((libro.get("autor") or "").split(",")[0], "Autor desconocido")
    titulo = sanear(libro.get("titulo"), "Sin título")
    narrador = (libro.get("narrador") or "").split(",")[0].strip()
    nombre = f"{titulo} ({sanear(narrador)})" if narrador else titulo
    return os.path.join(biblioteca(), autor, nombre)


def es_audio(ruta: str) -> bool:
    return os.path.splitext(ruta)[1].lower() in EXT_AUDIO


def clave_orden(nombre: str):
    """Orden natural: «Parte 2» antes que «Parte 10»."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", nombre)]


def archivos_audio(carpeta: str) -> list[str]:
    res = []
    for raiz, _, nombres in os.walk(carpeta):
        for n in nombres:
            if es_audio(n):
                res.append(os.path.join(raiz, n))
    return sorted(res, key=lambda r: clave_orden(os.path.relpath(r, carpeta)))


def info_audio(ruta: str) -> dict:
    """Duración (s) y portada embebida (bytes) usando mutagen."""
    res = {"duracion": 0.0, "portada": None, "titulo": None, "autor": None}
    try:
        import mutagen
        f = mutagen.File(ruta)
        if f is None:
            return res
        res["duracion"] = float(getattr(f.info, "length", 0) or 0)
        tags = f.tags or {}
        # MP4/M4B
        if "covr" in tags and tags["covr"]:
            res["portada"] = bytes(tags["covr"][0])
        if "\xa9nam" in tags:
            res["titulo"] = str(tags["\xa9nam"][0])
        if "\xa9ART" in tags:
            res["autor"] = str(tags["\xa9ART"][0])
        # ID3
        if hasattr(tags, "getall"):
            apic = tags.getall("APIC")
            if apic:
                res["portada"] = apic[0].data
        # FLAC
        if getattr(f, "pictures", None):
            res["portada"] = f.pictures[0].data
    except Exception as e:  # noqa: BLE001
        log.debug("mutagen no pudo leer %s: %s", ruta, e)
    return res


async def descargar_portada(url: str, destino: str) -> bool:
    if not url:
        return False
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as cli:
            r = await cli.get(url)
        if r.status_code == 200 and r.content:
            os.makedirs(os.path.dirname(destino), exist_ok=True)
            with open(destino, "wb") as fh:
                fh.write(r.content)
            return True
    except Exception as e:  # noqa: BLE001
        log.warning("No se pudo descargar la portada %s: %s", url, e)
    return False


def svg_iniciales(titulo: str) -> str:
    palabras = [p for p in re.split(r"\s+", titulo or "") if p and p[0].isalnum()]
    ini = "".join(p[0] for p in palabras[:2]).upper() or "?"
    tono = sum(ord(c) for c in titulo or "") % 360
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">'
            f'<rect width="500" height="500" fill="hsl({tono},35%,22%)"/>'
            f'<text x="50%" y="54%" font-family="system-ui,sans-serif" font-size="190" font-weight="700" '
            f'fill="#14b8a6" text-anchor="middle" dominant-baseline="middle">{html.escape(ini)}</text></svg>')


async def ruta_portada(libro: dict) -> str | None:
    """Devuelve la ruta de una portada en disco (caché, cover.jpg o embebida), o None."""
    cache = os.path.join(config.RUTA_PORTADAS, f"{libro['id']}.jpg")
    if os.path.exists(cache):
        return cache
    if libro.get("ruta"):
        cover = os.path.join(libro["ruta"], "cover.jpg")
        if os.path.exists(cover):
            return cover
    if libro.get("portada_url") and await descargar_portada(libro["portada_url"], cache):
        return cache
    if libro.get("ruta") and os.path.isdir(libro["ruta"]):
        for a in archivos_audio(libro["ruta"])[:1]:
            datos = (await asyncio.to_thread(info_audio, a))["portada"]
            if datos:
                os.makedirs(config.RUTA_PORTADAS, exist_ok=True)
                with open(cache, "wb") as fh:
                    fh.write(datos)
                return cache
    return None


def tamano_carpeta(carpeta: str) -> int:
    total = 0
    for raiz, _, nombres in os.walk(carpeta):
        for n in nombres:
            try:
                total += os.path.getsize(os.path.join(raiz, n))
            except OSError:
                pass
    return total


def _leer_carpeta(carpeta: str) -> dict:
    audios = archivos_audio(carpeta)
    duracion = 0.0
    for a in audios:
        duracion += info_audio(a)["duracion"]
    return {"n": len(audios), "duracion_min": round(duracion / 60) if duracion else None,
            "tamano": tamano_carpeta(carpeta)}


def _separar_narrador(nombre: str) -> tuple[str, str]:
    m = re.match(r"^(.*?)\s*\(([^()]+)\)\s*$", nombre)
    if not m or re.fullmatch(r"\d{4}", m.group(2).strip()):   # «Título (2024)» es el año, no el narrador
        return (nombre if not m else m.group(1), "")
    return (m.group(1), m.group(2))


async def escanear() -> dict:
    """Recorre /audiolibros/{Autor}/{Libro}/ y crea o actualiza libros `descargado`."""
    raiz = biblioteca()
    if not os.path.isdir(raiz):
        raise FileNotFoundError(f"La carpeta de la biblioteca no existe: {raiz}")
    nuevos = actualizados = 0
    for autor in sorted(os.listdir(raiz)):
        d_autor = os.path.join(raiz, autor)
        if not os.path.isdir(d_autor) or autor.startswith("."):
            continue
        for libro_dir in sorted(os.listdir(d_autor)):
            carpeta = os.path.join(d_autor, libro_dir)
            if not os.path.isdir(carpeta):
                continue
            datos = await asyncio.to_thread(_leer_carpeta, carpeta)
            if not datos["n"]:
                continue
            existente = db.uno("SELECT * FROM libros WHERE ruta=?", (carpeta,))
            if existente:
                db.actualizar("libros", existente["id"], {
                    "tamano": datos["tamano"], "estado": "descargado", "actualizado": db.ahora(),
                    "duracion_min": existente["duracion_min"] or datos["duracion_min"]})
                actualizados += 1
                continue
            titulo, narrador = _separar_narrador(libro_dir)
            # ¿Es un deseado que ya está en disco?
            deseado = None
            for c in db.consultar("SELECT * FROM libros WHERE ruta IS NULL OR ruta=''"):
                if scoring.normalizar(c["titulo"]) == scoring.normalizar(titulo):
                    deseado = c
                    break
            if deseado:
                db.actualizar("libros", deseado["id"], {"ruta": carpeta, "estado": "descargado",
                                                       "tamano": datos["tamano"], "actualizado": db.ahora()})
                actualizados += 1
                continue
            fila = {"titulo": titulo, "autor": autor, "narrador": narrador, "estado": "descargado",
                    "ruta": carpeta, "tamano": datos["tamano"], "duracion_min": datos["duracion_min"],
                    "añadido": db.ahora(), "actualizado": db.ahora()}
            # Completar con Audible (solo campos vacíos)
            try:
                for m in await metadata.buscar(f"{titulo} {autor}"):
                    if scoring.normalizar(m["titulo"]).startswith(scoring.normalizar(titulo)[:20]):
                        extra = metadata.a_libro(m)
                        for k, v in extra.items():
                            if v and not fila.get(k):
                                fila[k] = v
                        break
            except Exception as e:  # noqa: BLE001
                log.debug("Sin metadatos para %s: %s", titulo, e)
            nuevo_id = db.insertar("libros", fila)
            db.historial("importado", f"Encontrado en la biblioteca: {titulo} ({autor})", nuevo_id)
            nuevos += 1
    # Libros descargados cuya carpeta ya no existe
    for l in db.consultar("SELECT id, ruta, titulo FROM libros WHERE estado='descargado' AND ruta IS NOT NULL AND ruta<>''"):
        if not os.path.isdir(l["ruta"]):
            db.actualizar("libros", l["id"], {"estado": "deseado", "ruta": None, "actualizado": db.ahora()})
            db.historial("borrado", f"La carpeta de «{l['titulo']}» ya no existe; vuelve a deseados", l["id"])
    return {"nuevos": nuevos, "actualizados": actualizados}
