"""Importa descargas completadas a la biblioteca (hardlink o copia; nunca mover)."""
import asyncio
import json
import logging
import os
import shutil

from . import db, library, notify

log = logging.getLogger("narrarr.importador")


def _enlazar_o_copiar(origen: str, destino: str) -> str:
    """Hardlink si es el mismo sistema de archivos; si falla, copia. Nunca mueve (hay que seguir sembrando)."""
    if os.path.exists(destino):
        return "existe"
    try:
        os.link(origen, destino)
        return "enlace"
    except OSError:
        shutil.copy2(origen, destino)
        return "copia"


def _metadata_json(libro: dict) -> dict:
    def lista(v):
        return [x.strip() for x in (v or "").split(",") if x.strip()]
    series = []
    if libro.get("serie"):
        series.append(f"{libro['serie']} #{libro['serie_pos']}" if libro.get("serie_pos") else libro["serie"])
    return {
        "title": libro.get("titulo"), "subtitle": libro.get("subtitulo") or None,
        "authors": lista(libro.get("autor")), "narrators": lista(libro.get("narrador")),
        "series": series, "description": libro.get("sinopsis") or None, "asin": libro.get("asin"),
        "publishedYear": str(libro["anio"]) if libro.get("anio") else None,
        "language": "spa" if (libro.get("idioma") or "spanish").lower() in ("spanish", "español", "castellano") else libro.get("idioma"),
        "genres": [], "tags": [],
    }


def _copiar_archivos(origen: str, destino: str) -> list[str]:
    if os.path.isfile(origen):
        audios = [origen] if library.es_audio(origen) else []
        base = os.path.dirname(origen)
    else:
        audios = library.archivos_audio(origen)
        base = origen
    if not audios:
        raise ValueError("La descarga no contiene archivos de audio")
    os.makedirs(destino, exist_ok=True)
    hechos = []
    # Varios mp3 en subcarpetas (CD1, CD2...): se aplana con prefijo para conservar el orden
    planos = len({os.path.dirname(a) for a in audios}) > 1
    for i, a in enumerate(audios, 1):
        if planos:
            rel = os.path.relpath(a, base).replace(os.sep, " - ")
            nombre = f"{i:03d} - {library.sanear(rel)}"
        else:
            nombre = library.sanear(os.path.basename(a))
        _enlazar_o_copiar(a, os.path.join(destino, nombre))
        hechos.append(nombre)
    return hechos


async def importar(descarga_id: int, ruta_origen: str | None = None) -> dict:
    """Importa una descarga. Lanza excepción con mensaje en castellano si falla."""
    d = db.uno("SELECT * FROM descargas WHERE id=?", (descarga_id,))
    if not d:
        raise ValueError("La descarga no existe")
    libro = db.uno("SELECT * FROM libros WHERE id=?", (d["libro_id"],))
    if not libro:
        raise ValueError("El libro de esta descarga ya no existe")
    origen = ruta_origen or d.get("ruta_origen")
    if not origen or not os.path.exists(origen):
        raise FileNotFoundError(f"No se encuentra la descarga en disco: {origen or '(sin ruta)'}")
    destino = library.carpeta_destino(libro)
    try:
        archivos = await asyncio.to_thread(_copiar_archivos, origen, destino)
        # Portada: Audible > existente en la descarga > embebida
        cover = os.path.join(destino, "cover.jpg")
        if not os.path.exists(cover):
            if not await library.descargar_portada(libro.get("portada_url"), cover):
                cand = [os.path.join(origen, n) for n in (os.listdir(origen) if os.path.isdir(origen) else [])
                        if n.lower() in ("cover.jpg", "folder.jpg", "cover.png")]
                if cand:
                    await asyncio.to_thread(shutil.copy2, cand[0], cover)
                else:
                    datos = (await asyncio.to_thread(library.info_audio, os.path.join(destino, archivos[0])))["portada"]
                    if datos:
                        with open(cover, "wb") as fh:
                            fh.write(datos)
        with open(os.path.join(destino, "metadata.json"), "w", encoding="utf-8") as fh:
            json.dump(_metadata_json(libro), fh, ensure_ascii=False, indent=2)
    except Exception as e:
        db.actualizar("descargas", descarga_id, {"estado": "fallida", "error": f"Error al importar: {e}"})
        db.historial("fallo", f"No se pudo importar «{libro['titulo']}»: {e}", libro["id"])
        raise
    tamano = await asyncio.to_thread(library.tamano_carpeta, destino)
    db.actualizar("libros", libro["id"], {"estado": "descargado", "ruta": destino, "tamano": tamano,
                                         "actualizado": db.ahora()})
    db.actualizar("descargas", descarga_id, {"estado": "importada", "terminado": db.ahora(), "error": None,
                                             "ruta_origen": origen})
    db.historial("importado", f"Importado «{libro['titulo']}» en {destino} ({len(archivos)} archivos)", libro["id"])
    log.info("Importado %s → %s", libro["titulo"], destino)
    await notify.libro_importado(libro)
    return {"destino": destino, "archivos": archivos}
