"""Acceso a SQLite (sqlite3 estándar, sin ORM) y migraciones simples."""
import json
import os
import sqlite3
import threading
from datetime import datetime

RUTA_CONFIG = os.environ.get("NARRARR_CONFIG", "/config")
RUTA_DB = os.path.join(RUTA_CONFIG, "narrarr.db")

_bloqueo = threading.RLock()
_conexion: sqlite3.Connection | None = None

ESQUEMA = """
CREATE TABLE IF NOT EXISTS libros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asin TEXT, titulo TEXT NOT NULL, subtitulo TEXT, autor TEXT, narrador TEXT,
    serie TEXT, serie_pos TEXT, anio INTEGER, duracion_min INTEGER, idioma TEXT,
    sinopsis TEXT, portada_url TEXT, estado TEXT NOT NULL DEFAULT 'deseado',
    ruta TEXT, tamano INTEGER, "añadido" TEXT, actualizado TEXT, ultima_busqueda TEXT
);
CREATE INDEX IF NOT EXISTS ix_libros_asin ON libros(asin);
CREATE INDEX IF NOT EXISTS ix_libros_estado ON libros(estado);
CREATE TABLE IF NOT EXISTS autores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL, asin TEXT, foto_url TEXT, vigilado INTEGER NOT NULL DEFAULT 0, "añadido" TEXT
);
CREATE TABLE IF NOT EXISTS descargas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    libro_id INTEGER, hash TEXT, titulo_release TEXT, indexador TEXT, tamano INTEGER,
    progreso REAL DEFAULT 0, estado TEXT NOT NULL DEFAULT 'en_cola', ruta_origen TEXT,
    "añadido" TEXT, terminado TEXT, error TEXT
);
CREATE INDEX IF NOT EXISTS ix_descargas_hash ON descargas(hash);
CREATE TABLE IF NOT EXISTS historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT, tipo TEXT, libro_id INTEGER, mensaje TEXT
);
CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS meta (clave TEXT PRIMARY KEY, valor TEXT);
"""

VERSION_ESQUEMA = 1


def ahora() -> str:
    return datetime.now().isoformat(timespec="seconds")


def conexion() -> sqlite3.Connection:
    global _conexion
    if _conexion is None:
        os.makedirs(RUTA_CONFIG, exist_ok=True)
        _conexion = sqlite3.connect(RUTA_DB, check_same_thread=False, isolation_level=None)
        _conexion.row_factory = sqlite3.Row
        _conexion.execute("PRAGMA journal_mode=WAL")
        _conexion.execute("PRAGMA foreign_keys=ON")
    return _conexion


def iniciar() -> None:
    """Crea el esquema y aplica migraciones pendientes."""
    with _bloqueo:
        c = conexion()
        c.executescript(ESQUEMA)
        fila = c.execute("SELECT valor FROM meta WHERE clave='version'").fetchone()
        version = int(fila["valor"]) if fila else 0
        # Aquí irían migraciones: if version < 2: ALTER TABLE ...
        if version < VERSION_ESQUEMA:
            c.execute("INSERT OR REPLACE INTO meta(clave, valor) VALUES('version', ?)", (str(VERSION_ESQUEMA),))


def consultar(sql: str, params: tuple | list = ()) -> list[dict]:
    with _bloqueo:
        return [dict(f) for f in conexion().execute(sql, params).fetchall()]


def uno(sql: str, params: tuple | list = ()) -> dict | None:
    with _bloqueo:
        f = conexion().execute(sql, params).fetchone()
        return dict(f) if f else None


def ejecutar(sql: str, params: tuple | list = ()) -> int:
    """Ejecuta y devuelve lastrowid (o filas afectadas si no aplica)."""
    with _bloqueo:
        cur = conexion().execute(sql, params)
        return cur.lastrowid if cur.lastrowid else cur.rowcount


def insertar(tabla: str, datos: dict) -> int:
    cols = ", ".join(f'"{k}"' for k in datos)
    marcas = ", ".join("?" for _ in datos)
    return ejecutar(f"INSERT INTO {tabla} ({cols}) VALUES ({marcas})", list(datos.values()))


def actualizar(tabla: str, id_: int, datos: dict) -> None:
    if not datos:
        return
    sets = ", ".join(f'"{k}"=?' for k in datos)
    ejecutar(f"UPDATE {tabla} SET {sets} WHERE id=?", list(datos.values()) + [id_])


def historial(tipo: str, mensaje: str, libro_id: int | None = None) -> None:
    insertar("historial", {"fecha": ahora(), "tipo": tipo, "libro_id": libro_id, "mensaje": mensaje})


def ajuste_leer_todos() -> dict:
    res = {}
    for f in consultar("SELECT clave, valor FROM ajustes"):
        try:
            res[f["clave"]] = json.loads(f["valor"])
        except (TypeError, ValueError):
            res[f["clave"]] = f["valor"]
    return res


def ajuste_guardar(clave: str, valor) -> None:
    ejecutar("INSERT OR REPLACE INTO ajustes(clave, valor) VALUES(?, ?)", (clave, json.dumps(valor, ensure_ascii=False)))
