"""Búsqueda de lanzamientos: Prowlarr (API v1) y Torznab genérico."""
import logging
import re
import xml.etree.ElementTree as ET

import httpx

from . import config, scoring

log = logging.getLogger("narrarr.indexadores")
TIMEOUT = httpx.Timeout(60.0, connect=10.0)


class ErrorIndexador(Exception):
    pass


def _categorias() -> list[str]:
    return [c.strip() for c in str(config.obtener("prowlarr_categorias") or "3030,3000").split(",") if c.strip()]


async def buscar_prowlarr(query: str) -> list[dict]:
    url = config.obtener("prowlarr_url")
    clave = config.obtener("prowlarr_key")
    if not url or not clave:
        raise ErrorIndexador("Prowlarr no está configurado (falta URL o clave API)")
    params = [("query", query), ("type", "search")] + [("categories", c) for c in _categorias()]
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as cli:
            r = await cli.get(f"{url}/api/v1/search", params=params, headers={"X-Api-Key": clave})
    except httpx.HTTPError as e:
        raise ErrorIndexador(f"No se puede conectar con Prowlarr en {url}: {e.__class__.__name__}") from e
    if r.status_code == 401:
        raise ErrorIndexador("Prowlarr rechaza la clave API (401)")
    if r.status_code >= 400:
        raise ErrorIndexador(f"Prowlarr respondió con error {r.status_code}")
    res = []
    for x in r.json() or []:
        res.append({
            "guid": x.get("guid"), "titulo": x.get("title") or "", "indexador": x.get("indexer") or "",
            "indexador_id": x.get("indexerId"), "tamano": x.get("size") or 0,
            "semillas": x.get("seeders"), "pares": x.get("leechers"), "fecha": x.get("publishDate"),
            "url_descarga": x.get("downloadUrl") or x.get("magnetUrl") or "",
            "categorias": [c.get("id") for c in (x.get("categories") or [])],
        })
    return res


async def buscar_torznab(url: str, clave: str, query: str) -> list[dict]:
    """Torznab genérico (Jackett u otros). No se usa por defecto, queda disponible."""
    params = {"t": "search", "q": query, "apikey": clave, "cat": ",".join(_categorias())}
    async with httpx.AsyncClient(timeout=TIMEOUT) as cli:
        r = await cli.get(url, params=params)
        r.raise_for_status()
    ns = {"torznab": "http://torznab.com/schemas/2015/feed"}
    res = []
    for item in ET.fromstring(r.content).iter("item"):
        attrs = {a.get("name"): a.get("value") for a in item.findall("torznab:attr", ns)}
        enc = item.find("enclosure")
        res.append({
            "guid": item.findtext("guid"), "titulo": item.findtext("title") or "",
            "indexador": (item.find("jackettindexer").text if item.find("jackettindexer") is not None else "torznab"),
            "indexador_id": None, "tamano": int(item.findtext("size") or attrs.get("size") or 0),
            "semillas": int(attrs["seeders"]) if attrs.get("seeders") else None,
            "pares": int(attrs["peers"]) if attrs.get("peers") else None,
            "fecha": item.findtext("pubDate"),
            "url_descarga": enc.get("url") if enc is not None else item.findtext("link"),
            "categorias": [],
        })
    return res


def puntuar_lista(releases: list[dict], titulo: str, autor: str) -> list[dict]:
    aj = config.todos()
    vistos = set()
    res = []
    for r in releases:
        clave = r.get("guid") or r.get("titulo")
        if clave in vistos:
            continue
        vistos.add(clave)
        p = scoring.puntuar(r, titulo, autor, aj)
        res.append({**{k: v for k, v in r.items() if k != "categorias"}, **p})
    res.sort(key=lambda x: (x["rechazado"], -x["puntuacion"]))
    return res


async def buscar_libro(libro: dict) -> list[dict]:
    """Busca «título autor» y, si no sale nada, solo el título."""
    titulo = scoring.titulo_limpio(libro.get("titulo")) or (libro.get("titulo") or "")
    autor = (libro.get("autor") or "").split(",")[0].strip()
    # De más concreta a más amplia; «El Señor de los Anillos nº 02/03 Las Dos Torres» → también «Las Dos Torres»
    consultas = [f"{titulo} {autor}".strip(), titulo]
    m = re.search(r"(?i)n[ºo°]\.?\s*\d+\s*/\s*\d+\s+(.+)$", libro.get("titulo") or "")
    if m:
        consultas.append(m.group(1))
    releases = []
    for c in dict.fromkeys(consultas):
        releases = await buscar_prowlarr(c)
        if releases:
            break
    return puntuar_lista(releases, titulo, libro.get("autor") or "")
