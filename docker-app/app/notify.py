"""Avisos por Telegram y refresco de Jellyfin/Emby (todo opcional)."""
import html
import logging

import httpx

from . import config

log = logging.getLogger("narrarr.avisos")
TIMEOUT = httpx.Timeout(15.0)


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
    except Exception as e:  # noqa: BLE001
        log.warning("Fallo en los avisos tras importar: %s", e)
