"""Pruebas mínimas de la puntuación de lanzamientos."""
from app.scoring import MB, GB, normalizar, puntuar

TITULO, AUTOR = "El nombre del viento", "Patrick Rothfuss"


def r(titulo, semillas=10, tamano=500 * MB):
    return {"titulo": titulo, "semillas": semillas, "tamano": tamano}


def test_normalizar_quita_tildes():
    assert normalizar("Él Nombre, del VIENTO!") == "el nombre del viento"


def test_castellano_m4b_gana_a_ingles():
    es = puntuar(r("Patrick Rothfuss - El nombre del viento [Castellano] [M4B] [Íntegro]"), TITULO, AUTOR)
    en = puntuar(r("Patrick Rothfuss - The Name of the Wind [English] mp3"), TITULO, AUTOR)
    assert es["puntuacion"] > en["puntuacion"]
    assert es["formato"] == "m4b" and es["idioma"] == "castellano"
    assert any("castellano" in m for m in es["motivos"])
    assert en["rechazado"]  # el título no coincide


def test_latino_penaliza():
    p = puntuar(r("El nombre del viento Patrick Rothfuss Latino mp3"), TITULO, AUTOR)
    assert p["puntuacion"] < 0


def test_ebook_penaliza():
    p = puntuar(r("El nombre del viento - Patrick Rothfuss epub castellano"), TITULO, AUTOR)
    assert any("−500" in m for m in p["motivos"])


def test_rechazos():
    assert puntuar(r("El nombre del viento castellano", semillas=0), TITULO, AUTOR)["rechazado"]
    assert puntuar(r("El nombre del viento castellano", tamano=1 * MB), TITULO, AUTOR)["rechazado"]
    assert puntuar(r("El nombre del viento castellano", tamano=11 * GB), TITULO, AUTOR)["rechazado"]
    assert puntuar(r("Otro libro distinto castellano"), TITULO, AUTOR)["rechazado"]


def test_semillas_con_tope():
    a = puntuar(r("El nombre del viento castellano", semillas=5), TITULO, AUTOR)
    b = puntuar(r("El nombre del viento castellano", semillas=500), TITULO, AUTOR)
    assert b["puntuacion"] - a["puntuacion"] == 15


def test_abreviado():
    p = puntuar(r("El nombre del viento castellano abreviado"), TITULO, AUTOR)
    assert any("abreviada" in m for m in p["motivos"])
