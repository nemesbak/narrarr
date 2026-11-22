# Narrarr — especificación (contrato común)

**Narrarr** es un gestor tipo *arr de **audiolibros**, todo en **castellano** (interfaz, mensajes, README, logs). Un solo contenedor Docker.
Imagen `nemesbak/narrarr`, repositorio `github.com/nemesbak/narrarr`, puerto **8787**, licencia MIT.

## Pila
- Backend: **Python 3.12 + FastAPI + uvicorn**, SQLite (`/config/narrarr.db`), `httpx` (asíncrono), planificador con `asyncio` (sin Celery).
- Frontend: SPA **sin build** (HTML + CSS + JS vanilla, módulos ES) servida por FastAPI en `/`. Nada de CDN obligatorios (que funcione offline en LAN); fuente del sistema.
- Metadatos de audio: `mutagen` (duración, tags, portada embebida). Nada de ffmpeg.

## Estructura del repo
```
narrarr/
  docker-app/
    Dockerfile  entrypoint.sh  requirements.txt  docker-compose.yml
    app/
      main.py          # FastAPI, monta /api y estáticos
      config.py        # ajustes (DB + env vars por defecto)
      db.py            # SQLite (sqlite3 estándar, sin ORM), migraciones simples
      metadata.py      # Audible ES (+ fallback Google Books)
      indexers.py      # Prowlarr (API v1) y Torznab genérico
      scoring.py       # puntuación de lanzamientos
      downloader.py    # qBittorrent Web API v2
      importer.py      # importar descargas completadas a la biblioteca
      library.py       # escanear la biblioteca en disco
      scheduler.py     # tareas periódicas
      notify.py        # Telegram opcional + refresco Jellyfin/Emby opcional
      static/          # index.html, app.js, styles.css, icon.svg, favicon
  unraid-template/narrarr.xml
  docs/  README.md  LICENSE  icon.svg  .github/workflows/docker.yml (opcional)
```

## Volúmenes y variables (contenedor)
- `/config` (DB, portadas en caché, log), `/audiolibros` (biblioteca), `/descargas` (donde qBittorrent deja lo terminado, misma ruta que ve qBit o mapeada con `QBIT_RUTA_REMOTA` → `/descargas`).
- Env (todas opcionales, también editables en Ajustes, la DB manda si existe): `PUID`=99, `PGID`=100, `TZ`=Europe/Madrid, `NARRARR_PUERTO`=8787,
  `PROWLARR_URL`, `PROWLARR_KEY`, `QBIT_URL`, `QBIT_USUARIO`, `QBIT_CLAVE`, `QBIT_CATEGORIA`=audiolibros, `QBIT_RUTA_REMOTA` (ruta de las descargas según qBit, p. ej. `/datos/torrents/audiolibros`),
  `TELEGRAM_TOKEN`, `TELEGRAM_CHAT`, `JELLYFIN_URL`, `JELLYFIN_KEY`, `EMBY_URL`, `EMBY_KEY`.
- Cabecera para Emby/Jellyfin: `Authorization: MediaBrowser Token="KEY"` (Jellyfin 12 ya no acepta X-Emby-Token).

## Modelo de datos (SQLite)
- `libros`: id, asin, titulo, subtitulo, autor, narrador, serie, serie_pos, anio, duracion_min, idioma, sinopsis, portada_url, estado (`deseado`|`buscando`|`descargando`|`descargado`|`ignorado`), ruta, tamano, añadido, actualizado, ultima_busqueda.
- `autores`: id, nombre, asin, foto_url, vigilado (bool), añadido.
- `descargas`: id, libro_id, hash, titulo_release, indexador, tamano, progreso, estado (`en_cola`|`descargando`|`completada`|`importada`|`fallida`), ruta_origen, añadido, terminado, error.
- `historial`: id, fecha, tipo (`buscado`|`capturado`|`importado`|`fallo`|`borrado`), libro_id, mensaje.
- `ajustes`: clave, valor (JSON).

## API REST (prefijo `/api`, JSON, errores `{ "detalle": "mensaje en castellano" }`)
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/estado` | versión, conexiones OK/KO (prowlarr, qbit, jellyfin, emby), nº libros por estado, espacio libre en /audiolibros, próxima tarea |
| GET | `/api/libros?estado=&q=&orden=titulo|autor|añadido|duracion` | lista de la biblioteca + deseados |
| GET | `/api/libros/{id}` | ficha completa + descargas + historial del libro |
| POST | `/api/libros` | añadir `{asin}` (desde metadatos) o `{titulo, autor}` manual → estado `deseado`; `buscar_ya: bool` |
| PATCH | `/api/libros/{id}` | editar campos / estado |
| DELETE | `/api/libros/{id}?borrar_archivos=false` | quitar |
| GET | `/api/metadatos/buscar?q=` | busca en Audible ES: `[{asin,titulo,subtitulo,autores[],narradores[],serie,serie_pos,duracion_min,anio,portada,sinopsis,idioma,en_biblioteca:bool}]` |
| GET | `/api/autores` / POST `/api/autores {nombre}` / GET `/api/autores/{id}` (libros del autor en Audible + cuáles tienes) / PATCH (vigilado) / DELETE |
| GET | `/api/lanzamientos?libro_id=` o `?q=` | busca en Prowlarr (categorías 3030 Audio/Audiobook + 3000), devuelve `[{guid,titulo,indexador,indexador_id,tamano,semillas,pares,fecha,formato,idioma,puntuacion,motivos[],rechazado:bool,url_descarga}]` ordenados por puntuación |
| POST | `/api/lanzamientos/capturar` | `{libro_id, guid, indexador_id, url_descarga, titulo}` → manda a qBittorrent (Prowlarr `POST /api/v1/search` con guid+indexerId, o descarga del .torrent y subida a qBit) |
| GET | `/api/descargas` | cola actual (cruzada con qBit por hash/categoría) |
| DELETE | `/api/descargas/{id}?borrar_datos=false` |
| POST | `/api/descargas/{id}/importar` | importar manualmente |
| GET | `/api/historial?limite=100` |
| GET/PUT | `/api/ajustes` | todos los ajustes (claves enmascaradas al leer: `"••••"` si existe) |
| POST | `/api/ajustes/probar/{servicio}` | prueba conexión prowlarr/qbit/telegram/jellyfin/emby → `{ok, mensaje}` |
| POST | `/api/tareas/{nombre}` | lanza ya: `buscar_deseados`, `escanear_biblioteca`, `comprobar_descargas`, `vigilar_autores` |
| GET | `/api/tareas` | lista de tareas con último/próximo |
| GET | `/api/portada/{libro_id}` | sirve portada (caché en /config/portadas, si no hay: genera SVG con iniciales) |
| GET | `/api/sistema/log?lineas=200` |

## Puntuación (scoring.py) — castellano primero
- +100 si detecta castellano (`spanish|español|castellano|esp|spa` o caracteres/palabras típicas), −1000 si `latino|latam|english|eng|inglés` sin castellano, −500 si `resumen|summary|ebook|epub|pdf|mobi|azw`.
- Formato: m4b +40, mp3 +20, flac +10. `[unabridged|íntegro]` +20, `abridged|abreviado` −50.
- Coincidencia de título (normalizado sin tildes) +0..60 y autor +0..30; sin coincidencia de título → rechazado.
- Semillas: +min(semillas,20); 0 semillas → rechazado. Tamaño < 5 MB o > 10 GB → rechazado.
- `motivos[]` en castellano explicando cada suma/resta.

## Importador
- Al completar (qBit `progress==1` y estado de seeding), copia **hardlink si mismo FS, si no copia** (nunca mover: hay que seguir sembrando en trackers privados) a `/audiolibros/{Autor}/{Título} ({Narrador})/` (sin narrador si no hay), limpia caracteres no válidos.
- Solo archivos de audio (`m4b m4a mp3 flac ogg opus aac wma`) + `cover.jpg` (descarga la portada de Audible si no existe; si hay portada embebida y no hay de Audible, la extrae).
- Si hay muchos mp3 sueltos con numeración, conserva el orden. Escribe `metadata.json` (formato tipo Audiobookshelf/abs: title, authors, narrators, series, description, asin) para que Audiobookshelf/Jellyfin lo lean.
- Tras importar: estado `descargado`, historial, aviso Telegram y refresco de Jellyfin/Emby (si configurados).

## Planificador
- `comprobar_descargas` cada 1 min, `buscar_deseados` cada 6 h (**con freno**: máx. 5 libros por pasada, 30 s entre búsquedas, cada libro como mucho 1 vez cada 24 h — los trackers privados banean búsquedas masivas), `escanear_biblioteca` cada 12 h, `vigilar_autores` cada 24 h (añade como `deseado` los libros nuevos en castellano de autores vigilados, sin buscar en bloque).

## Biblioteca existente
- `escanear_biblioteca` recorre `/audiolibros/{Autor}/{Libro}/`, crea/actualiza libros `descargado` con duración (mutagen), tamaño y portada (`cover.jpg` o embebida); intenta casar con Audible por título+autor para completar metadatos (sin machacar ediciones manuales).

## Interfaz (todo en castellano)
Estilo *arr moderno oscuro (tipo Sonarr/Readarr v4 pero más bonito): barra lateral con iconos (SVG inline) — **Biblioteca**, **Añadir**, **Autores**, **Deseados**, **Actividad** (cola + historial), **Ajustes**, **Sistema**. Color de acento turquesa `#14b8a6`. Tema oscuro por defecto y claro con `prefers-color-scheme`/conmutador.
- Biblioteca: rejilla de portadas cuadradas con insignias de estado, filtros, búsqueda, orden, vista lista; tarjeta → ficha con portada grande, sinopsis, narrador, serie, duración "12 h 30 min", archivos, botones *Buscar*, *Búsqueda interactiva* (tabla de lanzamientos con puntuación y motivos, botón capturar), *Editar*, *Borrar*.
- Añadir: buscador con resultados de Audible (portada, autor, narrador, duración, serie) y botón «Añadir» / «Añadir y buscar»; muestra «Ya lo tienes» si está.
- Autores: rejilla, ficha con sus libros (los que tienes marcados), interruptor «Vigilar».
- Actividad: cola con barras de progreso (refresco cada 5 s), historial.
- Ajustes: formularios con «Probar conexión» por servicio, rutas, programación, puntuación (preferir m4b, etc.).
- Sistema: estado de conexiones, tareas (lanzar ya), log.
- Notificaciones tipo toast, estados vacíos amables, responsive (móvil), accesible. Todo texto de UI en castellano de España.
