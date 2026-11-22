"""Puntuación de lanzamientos: castellano primero."""
import re
import unicodedata

MB = 1024 * 1024
GB = 1024 * MB

RE_CASTELLANO = re.compile(r"\b(spanish|español|espanol|castellano|esp|spa|cast)\b")
RE_OTRO_IDIOMA = re.compile(r"\b(latino|latam|english|eng|ingles|inglés)\b")
RE_NO_AUDIO = re.compile(r"\b(resumen|summary|ebook|epub|pdf|mobi|azw3?)\b")
RE_INTEGRO = re.compile(r"\b(unabridged|integro|íntegro|integra|íntegra)\b")
RE_ABREVIADO = re.compile(r"\b(abridged|abreviado|abreviada)\b")
# Palabras muy típicas del castellano en títulos de releases
PALABRAS_ES = {"el", "la", "los", "las", "del", "de", "y", "una", "un", "narrado", "por", "libro", "audiolibro"}


def normalizar(texto: str | None) -> str:
    """Minúsculas, sin tildes y sin signos: «El Nombre del Viento» → «el nombre del viento»."""
    if not texto:
        return ""
    t = unicodedata.normalize("NFKD", texto.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[^a-z0-9ñ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _coincidencia(buscado: str, titulo_release: str) -> float:
    """Fracción (0..1) de palabras significativas de `buscado` presentes en el release."""
    palabras = [p for p in normalizar(buscado).split() if len(p) > 2 or p.isdigit()]
    if not palabras:
        palabras = normalizar(buscado).split()
    if not palabras:
        return 0.0
    rel = set(normalizar(titulo_release).split())
    return sum(1 for p in palabras if p in rel) / len(palabras)


def detectar_formato(titulo: str) -> str:
    t = titulo.lower()
    for f in ("m4b", "flac", "mp3", "m4a", "opus", "ogg", "aac"):
        if re.search(rf"\b{f}\b", t):
            return f
    return ""


def detectar_idioma(titulo: str) -> str:
    t = titulo.lower()
    if RE_CASTELLANO.search(t):
        return "castellano"
    if re.search(r"\b(latino|latam)\b", t):
        return "latino"
    if re.search(r"\b(english|eng|ingles|inglés)\b", t):
        return "inglés"
    return ""


def puntuar(release: dict, titulo: str, autor: str = "", ajustes: dict | None = None) -> dict:
    """Devuelve {puntuacion, motivos[], rechazado, formato, idioma}.

    `release` usa claves titulo, tamano (bytes), semillas, categorias (lista de ids opcional).
    """
    aj = ajustes or {}
    nombre = release.get("titulo") or ""
    t = nombre.lower()
    t_norm = normalizar(nombre)
    puntos = 0
    motivos: list[str] = []
    rechazado = False

    # Idioma
    castellano = bool(RE_CASTELLANO.search(t)) or bool(RE_CASTELLANO.search(t_norm))
    otro_idioma = bool(RE_OTRO_IDIOMA.search(t) or RE_OTRO_IDIOMA.search(t_norm))
    # Heurística de palabras típicas solo si no hay marca explícita de otro idioma
    if not castellano and not otro_idioma:
        palabras = set(t_norm.split())
        if len(palabras & PALABRAS_ES) >= 2 or "ñ" in t:
            castellano = True
    if castellano:
        puntos += 100
        motivos.append("+100 castellano detectado")
    elif otro_idioma:
        puntos -= 1000
        motivos.append("−1000 otro idioma (latino/inglés) sin castellano")

    if RE_NO_AUDIO.search(t) or RE_NO_AUDIO.search(t_norm):
        puntos -= 500
        motivos.append("−500 parece un resumen o libro electrónico, no un audiolibro")

    # Formato
    formato = detectar_formato(nombre)
    tabla_fmt = {"m4b": aj.get("puntos_m4b", 40), "mp3": aj.get("puntos_mp3", 20), "flac": aj.get("puntos_flac", 10)}
    if formato in tabla_fmt:
        puntos += tabla_fmt[formato]
        motivos.append(f"+{tabla_fmt[formato]} formato {formato}")

    if RE_INTEGRO.search(t) or RE_INTEGRO.search(t_norm):
        puntos += 20
        motivos.append("+20 versión íntegra")
    elif RE_ABREVIADO.search(t_norm):
        puntos -= 50
        motivos.append("−50 versión abreviada")

    # Coincidencia de título y autor
    c_titulo = _coincidencia(titulo, nombre)
    if c_titulo <= 0:
        rechazado = True
        motivos.append("Rechazado: el título no coincide")
    else:
        p = round(60 * c_titulo)
        puntos += p
        motivos.append(f"+{p} coincidencia de título ({round(c_titulo * 100)} %)")
    if autor:
        # Se compara con cada autor por separado y se queda el mejor
        mejor = max((_coincidencia(a, nombre) for a in autor.split(",")), default=0)
        p = round(30 * mejor)
        if p:
            puntos += p
            motivos.append(f"+{p} coincidencia de autor ({round(mejor * 100)} %)")
        else:
            motivos.append("+0 el autor no aparece en el nombre")

    # Semillas
    semillas = release.get("semillas")
    if semillas is not None:
        if semillas <= 0:
            rechazado = True
            motivos.append("Rechazado: sin semillas")
        else:
            p = min(int(semillas), 20)
            puntos += p
            motivos.append(f"+{p} por {semillas} semillas")

    # Tamaño
    tamano = release.get("tamano") or 0
    if tamano and tamano < 5 * MB:
        rechazado = True
        motivos.append("Rechazado: demasiado pequeño (< 5 MB)")
    elif tamano > 10 * GB:
        rechazado = True
        motivos.append("Rechazado: demasiado grande (> 10 GB)")

    return {
        "puntuacion": puntos, "motivos": motivos, "rechazado": rechazado,
        "formato": formato, "idioma": detectar_idioma(nombre) or ("castellano" if castellano else ""),
    }
