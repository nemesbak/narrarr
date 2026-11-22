# Cambios

## 1.1.0 — 2026-11-22

- **Autor desde Audible**: en *Añadir* y en la ficha, el autor es un enlace a todo su catálogo en castellano, con «Añadir los que faltan» y «Vigilar novedades».
- **Seguimiento en la ficha**: Añadido → Buscado → Descargando (con %) → Importado, actualizado cada 5 s.
- Arreglo: qBittorrent 5.x responde JSON con `failure_count` y se tomaba como error; ahora se interpreta bien y los torrents que ya existen se adoptan.
- Búsquedas más listas: se quitan «nº 02/03», la serie entre paréntesis y similares; si no hay resultados se prueba con el final del título («Las Dos Torres»).
- Emparejamiento más estricto (≥60 % de palabras del título): «Fuego y sangre» ya no casa con «Juego de Tronos».
- Los traductores e ilustradores de Audible ya no aparecen como autores.
- Las carpetas nuevas se nombran con el título limpio.

## v1.0.0 — 2026-11-22

Primera versión.

- Interfaz web completa en castellano (Biblioteca, Añadir, Autores, Deseados, Actividad, Ajustes, Sistema), tema oscuro y claro.
- Metadatos de Audible España (narrador, serie, duración, sinopsis, portada) con Google Books de respaldo.
- Búsqueda en Prowlarr (categorías 3030 y 3000) con puntuación que prioriza el castellano y explica cada motivo.
- Envío a qBittorrent con categoría propia y seguimiento de la cola.
- Importación con hardlink (o copia si no hay mismo sistema de archivos), sin mover: el seedeo sigue intacto.
- `cover.jpg` y `metadata.json` para Jellyfin, Emby y Audiobookshelf.
- Escaneo de la biblioteca existente con duración y portada.
- Vigilancia de autores y planificador con freno anti-baneo para trackers privados.
- Avisos por Telegram y refresco de Jellyfin/Emby al importar.
- Plantilla de Unraid e imagen multi-arquitectura (amd64 y arm64).
