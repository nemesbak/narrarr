"""Cliente de qBittorrent (Web API v2) y obtención del .torrent desde Prowlarr."""
import asyncio
import hashlib
import logging
import re

import httpx

from . import config

log = logging.getLogger("narrarr.qbit")
TIMEOUT = httpx.Timeout(30.0, connect=10.0)
ETIQUETA = "narrarr"


class ErrorDescarga(Exception):
    pass


# ---------- bencode mínimo para calcular el infohash ----------

def _bdecode(datos: bytes, i: int = 0):
    """Decodifica un valor bencode desde la posición i. Devuelve (valor, siguiente posición)."""
    c = datos[i:i + 1]
    if c == b"i":
        fin = datos.index(b"e", i)
        return int(datos[i + 1:fin]), fin + 1
    if c == b"l":
        i += 1
        lista = []
        while datos[i:i + 1] != b"e":
            v, i = _bdecode(datos, i)
            lista.append(v)
        return lista, i + 1
    if c == b"d":
        i += 1
        d = {}
        while datos[i:i + 1] != b"e":
            k, i = _bdecode(datos, i)
            ini = i
            v, i = _bdecode(datos, i)
            d[k] = v
            if k == b"info":
                d[b"__info_rango__"] = (ini, i)
        return d, i + 1
    if c.isdigit():
        dos = datos.index(b":", i)
        n = int(datos[i:dos])
        return datos[dos + 1:dos + 1 + n], dos + 1 + n
    raise ValueError("bencode no válido")


def infohash(torrent: bytes) -> str:
    raiz, _ = _bdecode(torrent)
    if not isinstance(raiz, dict) or b"__info_rango__" not in raiz:
        raise ValueError("el archivo .torrent no tiene sección info")
    ini, fin = raiz[b"__info_rango__"]
    return hashlib.sha1(torrent[ini:fin]).hexdigest()


def hash_de_magnet(magnet: str) -> str | None:
    m = re.search(r"xt=urn:btih:([a-zA-Z0-9]+)", magnet)
    if not m:
        return None
    h = m.group(1)
    if len(h) == 32:  # base32
        import base64
        h = base64.b32decode(h.upper()).hex()
    return h.lower()


# ---------- cliente qBittorrent ----------

class QBit:
    def __init__(self):
        aj = config.todos()
        self.url = aj["qbit_url"]
        self.usuario = aj["qbit_usuario"]
        self.clave = aj["qbit_clave"]
        self.categoria = aj["qbit_categoria"] or "audiolibros"
        if not self.url:
            raise ErrorDescarga("qBittorrent no está configurado (falta la URL)")
        self.cli = httpx.AsyncClient(base_url=self.url, timeout=TIMEOUT, headers={"Referer": self.url})

    async def __aenter__(self):
        try:
            if self.usuario:
                r = await self.cli.post("/api/v2/auth/login", data={"username": self.usuario, "password": self.clave})
                if r.text.strip() != "Ok.":
                    raise ErrorDescarga("qBittorrent rechaza el usuario o la contraseña")
        except httpx.HTTPError as e:
            await self.cli.aclose()
            raise ErrorDescarga(f"No se puede conectar con qBittorrent en {self.url}: {e.__class__.__name__}") from e
        return self

    async def __aexit__(self, *a):
        await self.cli.aclose()

    async def _pedir(self, metodo: str, ruta: str, **kw) -> httpx.Response:
        try:
            r = await self.cli.request(metodo, ruta, **kw)
        except httpx.HTTPError as e:
            raise ErrorDescarga(f"Error de conexión con qBittorrent: {e.__class__.__name__}") from e
        if r.status_code == 403:
            raise ErrorDescarga("qBittorrent deniega el acceso (403): revisa usuario/contraseña o la lista blanca")
        if r.status_code >= 400:
            raise ErrorDescarga(f"qBittorrent respondió con error {r.status_code}: {r.text[:200]}")
        return r

    async def version(self) -> str:
        return (await self._pedir("GET", "/api/v2/app/version")).text

    async def torrents(self, hashes: str | None = None) -> list[dict]:
        params = {"hashes": hashes} if hashes else {"category": self.categoria}
        return (await self._pedir("GET", "/api/v2/torrents/info", params=params)).json()

    async def archivos(self, h: str) -> list[dict]:
        return (await self._pedir("GET", "/api/v2/torrents/files", params={"hash": h})).json()

    async def borrar(self, h: str, borrar_datos: bool = False) -> None:
        await self._pedir("POST", "/api/v2/torrents/delete",
                          data={"hashes": h, "deleteFiles": "true" if borrar_datos else "false"})

    async def anadir(self, torrent: bytes | None = None, magnet: str | None = None) -> None:
        data = {"category": self.categoria, "tags": ETIQUETA}
        if torrent is not None:
            r = await self._pedir("POST", "/api/v2/torrents/add", data=data,
                                  files={"torrents": ("narrarr.torrent", torrent, "application/x-bittorrent")})
        else:
            r = await self._pedir("POST", "/api/v2/torrents/add", data={**data, "urls": magnet})
        # qBittorrent 4.x responde «Ok.»/«Fails.»; la 5.x, JSON {success_count, failure_count, ...}
        txt = r.text.strip()
        try:
            j = r.json()
            ok = isinstance(j, dict) and (j.get("success_count", 0) > 0 or j.get("failure_count", 1) == 0)
        except ValueError:
            ok = txt.lower() != "fails."
        if not ok:
            raise ErrorDescarga("qBittorrent no aceptó el torrent (¿ya existe o es inválido?)")


async def obtener_torrent(url_descarga: str) -> tuple[bytes | None, str | None]:
    """Descarga el .torrent; si redirige a un magnet, devuelve el magnet."""
    if url_descarga.startswith("magnet:"):
        return None, url_descarga
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False) as cli:
        url = url_descarga
        for _ in range(5):
            try:
                r = await cli.get(url)
            except httpx.HTTPError as e:
                raise ErrorDescarga(f"No se pudo descargar el .torrent: {e.__class__.__name__}") from e
            if r.status_code in (301, 302, 303, 307, 308):
                destino = r.headers.get("location", "")
                if destino.startswith("magnet:"):
                    return None, destino
                url = str(r.url.join(destino))
                continue
            if r.status_code >= 400:
                raise ErrorDescarga(f"El indexador devolvió error {r.status_code} al descargar el .torrent")
            if r.content.startswith(b"magnet:"):
                return None, r.text.strip()
            if not r.content.startswith(b"d"):
                raise ErrorDescarga("La respuesta del indexador no es un archivo .torrent válido")
            return r.content, None
    raise ErrorDescarga("Demasiadas redirecciones al descargar el .torrent")


async def capturar(url_descarga: str) -> str:
    """Manda el lanzamiento a qBittorrent con categoría y etiqueta narrarr. Devuelve el hash."""
    if not url_descarga:
        raise ErrorDescarga("El lanzamiento no tiene URL de descarga")
    torrent, magnet = await obtener_torrent(url_descarga)
    h = infohash(torrent) if torrent else hash_de_magnet(magnet or "")
    async with QBit() as q:
        # Si ya está en qBittorrent (añadido antes o por otra app) se adopta: no hace falta volver a añadirlo
        if h and await q.torrents(h):
            log.info("El torrent %s ya estaba en qBittorrent: se adopta", h)
            try:
                await q._pedir("POST", "/api/v2/torrents/addTags", data={"hashes": h, "tags": ETIQUETA})
            except Exception:  # noqa: BLE001
                pass
            return h.lower()
        await q.anadir(torrent=torrent, magnet=magnet)
        if not h:
            # Último recurso: el torrent más reciente con nuestra etiqueta
            await asyncio.sleep(2)
            lista = [t for t in await q.torrents() if ETIQUETA in (t.get("tags") or "")]
            lista.sort(key=lambda t: t.get("added_on", 0), reverse=True)
            if lista:
                h = lista[0]["hash"]
    if not h:
        raise ErrorDescarga("Enviado a qBittorrent, pero no se pudo averiguar el hash")
    return h.lower()


def ruta_local(ruta_qbit: str) -> str:
    """Traduce la ruta que ve qBittorrent a la que ve Narrarr (QBIT_RUTA_REMOTA → /descargas)."""
    remota = (config.obtener("qbit_ruta_remota") or "").rstrip("/")
    local = (config.obtener("ruta_descargas") or "/descargas").rstrip("/")
    if remota and ruta_qbit.startswith(remota):
        return local + ruta_qbit[len(remota):]
    return ruta_qbit
