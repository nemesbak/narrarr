"""Metadatos de Audible ES (y Google Books como respaldo)."""
import html
import logging
import re

import httpx

from . import config

log = logging.getLogger("narrarr.metadatos")

AUDIBLE = "https://api.audible.es/1.0/catalog/products"
GRUPOS = "contributors,media,product_desc,product_attrs,series,product_extended_attrs"
TIMEOUT = httpx.Timeout(20.0)


def limpiar_html(texto: str | None) -> str:
    if not texto:
        return ""
    texto = re.sub(r"<\s*(br|/p|/li)\s*/?>", "\n", texto, flags=re.I)
    texto = re.sub(r"<[^>]+>", "", texto)
    texto = html.unescape(texto)
    texto = re.sub(r"[ \t]+", " ", texto)
    return re.sub(r"\n{3,}", "\n\n", texto).strip()


def _autores_reales(lista: list[dict]) -> list[str]:
    """Audible mete a traductores e ilustradores en authors: «Luis Domènech - translator», o sin ASIN."""
    lista = [a for a in lista if a.get("name") and not re.search(r"(?i)[-–(]\s*(translator|traductor|traducci|illustrator|ilustrador)", a["name"])]
    con_asin = [a for a in lista if a.get("asin")]
    return [a["name"].strip() for a in (con_asin or lista)]


def _normalizar(p: dict) -> dict:
    series = p.get("series") or []
    imgs = p.get("product_images") or {}
    fecha = p.get("release_date") or p.get("issue_date") or ""
    return {
        "asin": p.get("asin"),
        "titulo": p.get("title") or "",
        "subtitulo": p.get("subtitle") or "",
        "autores": _autores_reales(p.get("authors") or []),
        "autores_asin": [a.get("asin") for a in (p.get("authors") or [])],
        "narradores": [n.get("name") for n in (p.get("narrators") or []) if n.get("name")],
        "serie": series[0].get("title") if series else "",
        "serie_pos": str(series[0].get("sequence") or "") if series else "",
        "duracion_min": p.get("runtime_length_min"),
        "anio": int(fecha[:4]) if fecha[:4].isdigit() else None,
        "portada": imgs.get("500") or next(iter(imgs.values()), ""),
        "sinopsis": limpiar_html(p.get("publisher_summary") or p.get("merchandising_summary")),
        "idioma": p.get("language") or "",
    }


async def _audible(params: dict) -> list[dict]:
    params = {"num_results": 20, "response_groups": GRUPOS, "image_sizes": 500, **params}
    async with httpx.AsyncClient(timeout=TIMEOUT) as cli:
        r = await cli.get(AUDIBLE, params=params)
        r.raise_for_status()
        productos = r.json().get("products") or []
    res = [_normalizar(p) for p in productos]
    if config.obtener("solo_castellano"):
        res = [x for x in res if (x["idioma"] or "").lower() in ("spanish", "español", "castellano")]
    return res


async def _google_books(q: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=TIMEOUT) as cli:
        r = await cli.get("https://www.googleapis.com/books/v1/volumes",
                          params={"q": q, "langRestrict": "es", "maxResults": 20})
        r.raise_for_status()
        items = r.json().get("items") or []
    res = []
    for it in items:
        v = it.get("volumeInfo") or {}
        fecha = v.get("publishedDate") or ""
        res.append({
            "asin": None, "titulo": v.get("title") or "", "subtitulo": v.get("subtitle") or "",
            "autores": v.get("authors") or [], "autores_asin": [], "narradores": [],
            "serie": "", "serie_pos": "", "duracion_min": None,
            "anio": int(fecha[:4]) if fecha[:4].isdigit() else None,
            "portada": ((v.get("imageLinks") or {}).get("thumbnail") or "").replace("http://", "https://"),
            "sinopsis": limpiar_html(v.get("description")), "idioma": v.get("language") or "",
        })
    return res


async def buscar(q: str) -> list[dict]:
    """Busca por palabras clave en Audible; si falla o no hay nada, Google Books."""
    try:
        res = await _audible({"keywords": q})
        if res:
            return res
    except Exception as e:  # noqa: BLE001
        log.warning("Audible no responde (%s); se usa Google Books", e)
    try:
        return await _google_books(q)
    except Exception as e:  # noqa: BLE001
        log.warning("Google Books tampoco responde: %s", e)
        return []


async def buscar_autor(nombre: str) -> list[dict]:
    try:
        return await _audible({"author": nombre, "num_results": 50, "products_sort_by": "-ReleaseDate"})
    except Exception as e:  # noqa: BLE001
        log.warning("No se pudieron leer los libros de %s en Audible: %s", nombre, e)
        return []


async def ficha(asin: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as cli:
            r = await cli.get(f"{AUDIBLE}/{asin}", params={"response_groups": GRUPOS, "image_sizes": 500})
            r.raise_for_status()
            p = r.json().get("product")
        return _normalizar(p) if p and p.get("title") else None
    except Exception as e:  # noqa: BLE001
        log.warning("No se pudo leer la ficha %s de Audible: %s", asin, e)
        return None


def a_libro(m: dict) -> dict:
    """Convierte un resultado de metadatos en columnas de la tabla libros."""
    return {
        "asin": m.get("asin"), "titulo": m.get("titulo"), "subtitulo": m.get("subtitulo"),
        "autor": ", ".join(m.get("autores") or []), "narrador": ", ".join(m.get("narradores") or []),
        "serie": m.get("serie"), "serie_pos": m.get("serie_pos"), "anio": m.get("anio"),
        "duracion_min": m.get("duracion_min"), "idioma": m.get("idioma"),
        "sinopsis": m.get("sinopsis"), "portada_url": m.get("portada"),
    }
