# Cambios

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
