"""Ajustes: la tabla `ajustes` manda; si falta una clave se toma la variable de entorno o el valor por defecto."""
import os

from . import db

VERSION = "1.1.1"

RUTA_CONFIG = db.RUTA_CONFIG
RUTA_BIBLIOTECA = os.environ.get("NARRARR_BIBLIOTECA", "/audiolibros")
RUTA_DESCARGAS = os.environ.get("NARRARR_DESCARGAS", "/descargas")
RUTA_PORTADAS = os.path.join(RUTA_CONFIG, "portadas")
RUTA_LOG = os.path.join(RUTA_CONFIG, "narrarr.log")

MASCARA = "••••"

# clave -> (variable de entorno, valor por defecto, tipo)
DEFINICIONES: dict[str, tuple[str | None, object, type]] = {
    "prowlarr_url": ("PROWLARR_URL", "", str),
    "prowlarr_key": ("PROWLARR_KEY", "", str),
    "prowlarr_categorias": (None, "3030,3000", str),
    "qbit_url": ("QBIT_URL", "", str),
    "qbit_usuario": ("QBIT_USUARIO", "", str),
    "qbit_clave": ("QBIT_CLAVE", "", str),
    "qbit_categoria": ("QBIT_CATEGORIA", "audiolibros", str),
    "qbit_ruta_remota": ("QBIT_RUTA_REMOTA", "", str),
    "telegram_token": ("TELEGRAM_TOKEN", "", str),
    "telegram_chat": ("TELEGRAM_CHAT", "", str),
    "jellyfin_url": ("JELLYFIN_URL", "", str),
    "jellyfin_key": ("JELLYFIN_KEY", "", str),
    "emby_url": ("EMBY_URL", "", str),
    "emby_key": ("EMBY_KEY", "", str),
    "ruta_biblioteca": ("NARRARR_BIBLIOTECA", RUTA_BIBLIOTECA, str),
    "ruta_descargas": ("NARRARR_DESCARGAS", RUTA_DESCARGAS, str),
    "solo_castellano": (None, True, bool),
    # Programación (minutos) y freno de búsquedas
    "intervalo_comprobar_descargas": (None, 1, int),
    "intervalo_buscar_deseados": (None, 360, int),
    "intervalo_escanear_biblioteca": (None, 720, int),
    "intervalo_vigilar_autores": (None, 1440, int),
    "freno_max_libros": (None, 5, int),
    "freno_pausa_segundos": (None, 30, int),
    "freno_horas_por_libro": (None, 24, int),
    "captura_automatica": (None, True, bool),
    "puntuacion_minima": (None, 0, int),
    # Puntuación ajustable
    "puntos_m4b": (None, 40, int),
    "puntos_mp3": (None, 20, int),
    "puntos_flac": (None, 10, int),
}

SECRETOS = {"prowlarr_key", "qbit_clave", "telegram_token", "jellyfin_key", "emby_key"}


def _convertir(valor, tipo):
    if tipo is bool:
        if isinstance(valor, str):
            return valor.strip().lower() in ("1", "true", "si", "sí", "yes", "on")
        return bool(valor)
    if tipo is int:
        try:
            return int(valor)
        except (TypeError, ValueError):
            return None
    return "" if valor is None else str(valor)


def todos() -> dict:
    """Ajustes efectivos (sin enmascarar)."""
    guardados = db.ajuste_leer_todos()
    res = {}
    for clave, (env, defecto, tipo) in DEFINICIONES.items():
        if clave in guardados and guardados[clave] not in (None, ""):
            valor = guardados[clave]
        elif env and os.environ.get(env):
            valor = os.environ[env]
        else:
            valor = defecto
        v = _convertir(valor, tipo)
        res[clave] = defecto if v is None else v
    return res


def obtener(clave: str):
    return todos().get(clave)


def enmascarados() -> dict:
    res = todos()
    for k in SECRETOS:
        res[k] = MASCARA if res.get(k) else ""
    return res


def guardar(cambios: dict) -> None:
    for clave, valor in cambios.items():
        if clave not in DEFINICIONES:
            continue
        if clave in SECRETOS and isinstance(valor, str) and MASCARA in valor:
            continue  # no sobrescribir con la máscara
        tipo = DEFINICIONES[clave][2]
        v = _convertir(valor, tipo)
        if v is None:
            continue
        if isinstance(v, str):
            v = v.strip()
            if clave.endswith("_url"):
                v = v.rstrip("/")
        db.ajuste_guardar(clave, v)
