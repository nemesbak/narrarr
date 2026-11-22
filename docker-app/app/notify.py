"""Avisos por Telegram y refresco de Jellyfin/Emby (todo opcional)."""
import asyncio
import base64
import html
import logging
import os

import httpx

from . import config

log = logging.getLogger("narrarr.avisos")
TIMEOUT = httpx.Timeout(15.0)
_TAREAS: set = set()


def _cabecera(clave: str) -> dict:
    # Jellyfin 12 solo acepta esta cabecera (X-Emby-Token ya no sirve)
    return {"Authorization": f'MediaBrowser Token="{clave}"'}


async def telegram(texto_html: str) -> tuple[bool, str]:
    token, chat = config.obtener("telegram_token"), config.obtener("telegram_chat")
    if not token or not chat:
        return False, "Telegram no está configurado"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as cli:
            r = await cli.post(f"https://api.telegram.org/bot{token}/sendMessage",
                               json={"chat_id": chat, "text": texto_html, "parse_mode": "HTML"})
        if r.status_code == 200 and r.json().get("ok"):
            return True, "Mensaje enviado"
        return False, f"Telegram respondió: {r.json().get('description', r.status_code)}"
    except Exception as e:  # noqa: BLE001
        log.warning("Fallo al avisar por Telegram: %s", e)
        return False, f"No se pudo contactar con Telegram: {e.__class__.__name__}"


async def refrescar(servicio: str) -> tuple[bool, str]:
    url, clave = config.obtener(f"{servicio}_url"), config.obtener(f"{servicio}_key")
    nombre = servicio.capitalize()
    if not url or not clave:
        return False, f"{nombre} no está configurado"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as cli:
            r = await cli.post(f"{url}/Library/Refresh", headers=_cabecera(clave))
        if r.status_code < 300:
            return True, f"{nombre}: biblioteca en actualización"
        return False, f"{nombre} respondió con error {r.status_code}"
    except Exception as e:  # noqa: BLE001
        return False, f"No se puede conectar con {nombre}: {e.__class__.__name__}"


async def probar_servidor(servicio: str) -> tuple[bool, str]:
    url, clave = config.obtener(f"{servicio}_url"), config.obtener(f"{servicio}_key")
    nombre = servicio.capitalize()
    if not url or not clave:
        return False, f"{nombre} no está configurado"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as cli:
            r = await cli.get(f"{url}/System/Info", headers=_cabecera(clave))
        if r.status_code == 200:
            return True, f"Conectado a {r.json().get('ServerName', nombre)} (versión {r.json().get('Version', '?')})"
        if r.status_code == 401:
            return False, f"{nombre} rechaza la clave API (401)"
        return False, f"{nombre} respondió con error {r.status_code}"
    except Exception as e:  # noqa: BLE001
        return False, f"No se puede conectar con {nombre}: {e.__class__.__name__}"


async def libro_importado(libro: dict) -> None:
    """Aviso tras importar: Telegram + refresco de servidores. Nunca lanza excepciones."""
    try:
        texto = f"🎧 <b>{html.escape(libro.get('titulo') or '')}</b>"
        if libro.get("autor"):
            texto += f"\n✍️ {html.escape(libro['autor'])}"
        if libro.get("narrador"):
            texto += f"\n🎙️ {html.escape(libro['narrador'])}"
        texto += "\nAñadido a la biblioteca de audiolibros."
        await telegram(texto)
        for s in ("jellyfin", "emby"):
            await refrescar(s)
        if libro.get("ruta"):
            t = asyncio.create_task(portada_emby(libro["ruta"]))
            _TAREAS.add(t)
            t.add_done_callback(_TAREAS.discard)
    except Exception as e:  # noqa: BLE001
        log.warning("Fallo en los avisos tras importar: %s", e)


async def portada_emby(ruta: str, espera: int = 180) -> None:
    """Emby no usa el cover.jpg de la carpeta en libros de un solo archivo: se la subimos.
    No se incrusta en el audio porque suele ser un hardlink del torrent que sigue sembrando."""
    url, clave = config.obtener("emby_url"), config.obtener("emby_key")
    cover = os.path.join(ruta, "cover.jpg")
    if not url or not clave or not os.path.exists(cover):
        return
    await asyncio.sleep(espera)          # que Emby termine de escanear
    carpeta = os.path.basename(ruta.rstrip("/"))
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as cli:
            r = await cli.get(f"{url}/Items", headers=_cabecera(clave), params={
                "Recursive": "true", "IncludeItemTypes": "Audio", "Fields": "Path"})
            for it in r.json().get("Items", []):
                p = (it.get("Path") or "").replace("\\", "/")
                if os.path.basename(os.path.dirname(p)) != carpeta or (it.get("ImageTags") or {}).get("Primary"):
                    continue
                with open(cover, "rb") as fh:
                    datos = base64.b64encode(fh.read())
                await cli.post(f"{url}/Items/{it['Id']}/Images/Primary", content=datos,
                               headers={**_cabecera(clave), "Content-Type": "image/jpeg"})
                log.info("Portada subida a Emby: %s", it.get("Name"))
    except Exception as e:  # noqa: BLE001
        log.warning("No se pudo subir la portada a Emby: %s", e)
