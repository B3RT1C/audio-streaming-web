# Audio Streaming Web

Cliente web del ecosistema [audio-streaming](https://github.com/B3RT1C/audio-streaming). Versión **0.4.2**.

- Repo: https://github.com/B3RT1C/audio-streaming-web
- Stack: Angular 21, TypeScript, SCSS
- Sin login: pensado para una sola persona, dentro de su red Tailscale

## Requisitos

- Node.js 22+
- npm 10+
- Backend en marcha ([audio-streaming-backend](https://github.com/B3RT1C/audio-streaming-backend)), puerto 8080

## Arranque

```bash
npm install
npm start
```

La interfaz queda en `http://localhost:4200`. En local, la API se pide a `http://localhost:8080`.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm start` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` |
| `npm test` | Tests unitarios |
| `node scripts/ci/check-api-contract.mjs` | Comprueba las rutas del cliente |

## Funcionalidad 0.4.2

- Mismo contrato que 0.4.1. Los chips del buscador muestran el valor y el tipo, no el token, salvo mientras se escribe.
- La vista de etiquetas agrupa por el `key` del tipo aunque `GET /tags` envíe `type` como objeto. Los grupos grandes se pliegan y se pueden buscar, para no pintar miles de etiquetas a la vez.

## Funcionalidad 0.4.1

- Buscador unificado encima de la biblioteca. Se escribe con prefijo (`artista:`, `género:`, `álbum:`, `año:` con rangos `2010-2015`, `idioma:`, `playlist:`, la clave de un tipo propio como `mood:gym`, o `#etiqueta` / el nombre suelto para las libres). El autocompletado sale de `GET /filter/suggest` y se agrupa por tipo
- Cada filtro queda como chip del color de su tipo y se puede quitar. Siguen en la query (`f`, repetible) junto con la búsqueda y los filtros de 0.4.0
- El panel de 0.4.0 (título, artista, etiquetas de canción, de artista y de lista) sigue debajo, como alternativa
- El botón Aleatorio baraja el resultado de ese filtro unificado
- Editor de etiquetas de canción, artista y lista agrupado por tipo. Género, álbum y año se ven y no se pueden cambiar; idioma, libres y los tipos propios sí, con autocompletado
- Vista de etiquetas por tipos. Los de sistema llevan candado. Los propios se crean, se renombran y se borran (con confirmación). Pulsar una etiqueta abre la biblioteca filtrada con su token

## Funcionalidad 0.4.0

- Biblioteca con título, título secundario, artista, álbum, número de pista, duración y etiquetas
- Buscador con espera de 300 ms (`GET /audios?q=`). También busca en el título secundario
- Panel de filtros en la biblioteca (plegable en el móvil): título, artista, etiquetas de canción, de artista y de lista. Se combinan entre sí y con la búsqueda. Los filtros activos se ven como chips quitables y hay un botón para limpiarlos
- La vista filtrada queda en la query string, así se puede recargar o compartir
- Filtro por nombre y por etiquetas en Playlists y en Artistas
- Edición de título, título secundario, artista, álbum, número de pista y etiquetas
- Vista de artistas (conteo y etiquetas) y vista de etiquetas
- Listas: crear, renombrar, borrar, etiquetar, añadir, quitar y reordenar
- Reproducir la biblioteca, el resultado filtrado o una lista. El botón Aleatorio baraja esa lista completa en el cliente, con una semilla, sin repetir canciones hasta acabarla
- El reproductor sigue pudiendo mezclar la cola y repetir una o todas. Si el aleatorio está activo se indica en el reproductor
- Barra de progreso con salto
- Controles de la pantalla de bloqueo (Media Session), cuando el navegador lo permite
- Subida con barra de progreso, hasta 500 MB, y aviso si el archivo no es audio o se pasa del límite
- Listados largos (miles de canciones) con ventana virtual: solo se pintan las filas visibles
- Interfaz pensada primero para el móvil, e instalable como PWA (sin modo sin conexión)

## URL de la API

No hay ninguna IP escrita en el build. Al abrir la página, el cliente llama por defecto a:

```text
{protocolo de la página}//{hostname de la página}:8080
```

Así funciona igual por `localhost`, por la IP de Tailscale o por el nombre de la tailnet, siempre que el API esté en el puerto 8080 de esa misma máquina.

Para apuntar a otro sitio, edita `config.json` junto al `index.html` publicado (en desarrollo está en `public/config.json` y el build lo copia a la raíz del `dist`):

```json
{
  "apiUrl": "http://nombre-tailscale:8080"
}
```

`apiUrl` vacío, o un fichero ausente, dejan el valor por defecto. No hace falta recompilar: se lee cada vez que se abre la página.

La página y el API siguen yendo en orígenes distintos (por ejemplo la web en el puerto 8083 y el API en el 8080). El backend tiene que permitir el origen de la página en CORS.

## Contrato que consume esta versión

Alineado con el backend 0.4.1 (`docs/openapi.yaml` de la rama `feat/0.4.1` cuando esté publicada; el contrato de esta entrega está descrito aquí). Si un nombre cambia, el ajuste está en un solo sitio:

- Canciones: `src/app/features/audio/models/track.ts` (`normalizeTrack`)
- Listas: `src/app/features/audio/models/playlist.ts` (`normalizePlaylist`)
- Artistas y etiquetas: `src/app/features/audio/models/catalog.ts`
- Filtros y query string: `src/app/features/audio/utils/library-filters.ts` y `src/app/features/audio/utils/filter-tokens.ts`
- Etiquetas por tipo: `src/app/features/audio/utils/tag-assignment.ts`
- Cuerpos de las peticiones: `audio-service.ts`, `playlist-service.ts` y `catalog-service.ts`
- Textos de error: `src/app/features/audio/utils/api-error.ts`

| Petición | Cuerpo / respuesta |
|----------|--------------------|
| `GET /audios` | Array de canciones. `q`, `title`, `artist`, `tag`, `artistTag`, `playlistTag` y `f` (todos repetibles salvo los de texto) se combinan con AND. `f` es un token: `artista:`, `género:`, `álbum:`, `año:` (admite `2010-2015`), `idioma:`, `playlist:`, `clave:valor` de un tipo propio, o `#etiqueta` / el valor suelto para las libres. Los vacíos no se envían. `shuffle=true` y `seed` entero opcional piden un orden aleatorio determinista. Cada canción trae `secondaryTitle` y `tags` (nombre suelto o `{ type, name, readOnly }`) |
| `PATCH /audios/{id}` | Solo los campos a cambiar. `secondaryTitle` en blanco se envía como `null` y se borra. Si `title` no se edita, no se envía. Un campo `tags` en el PATCH se ignora |
| `PUT /audios/{id}/tags`, `PUT /artists/{id}/tags`, `PUT /playlists/{id}/tags` | `{ "tags": ["Gym", { "type": "language", "name": "Español" }] }`. Un string es una etiqueta libre. Un objeto asigna un tipo. Género, álbum y año no se envían: el servidor los conserva y respondería 400 si se asignan a mano |
| `GET /audios/{id}` | Stream. Un rango fuera del fichero responde 416 `RANGE_NOT_SATISFIABLE` |
| `POST /audios` | `file` y `name` opcional. Responde **201** `{ "message": "File received" }` **sin id**. Tras subir, la web vuelve a pedir el listado |
| `GET /tags` y `GET /tags?type=clave` | `[{ id, name, type, readOnly, audioCount, artistCount, playlistCount }]`. `type` puede ser la clave (`"genre"`) o el objeto `{ id, key, name, system }`; se usa `key` |
| `GET /tag-types` | `[{ id, key, name, system, color, conteos }]`. Los de sistema (`artist`, `genre`, `album`, `year`, `language`, `free`) no se renombran ni se borran |
| `POST /tag-types` | `{ name, key?, color? }` crea un tipo propio |
| `PATCH /tag-types/{id}` | `{ name }` renombra un tipo propio. Un tipo de sistema responde 409 |
| `DELETE /tag-types/{id}` | Borra un tipo propio. Un tipo de sistema responde 409 |
| `GET /filter/suggest?prefix=&q=` | `[{ type, value, count }]` para el autocompletado de todos los tipos |
| `GET /artists` y `GET /artists?q=&tag=` | `[{ id, name, audioCount, tags }]`. `q` y cada `tag` se combinan. No hay alta de artistas: salen del texto `artist` de las canciones |
| `PUT /artists/{id}/tags` | `{ "tags": [...] }` sustituye las etiquetas del artista |
| `GET /playlists` y `GET /playlists?q=&tag=` | Resúmenes `{ id, name, createdAt, updatedAt, itemCount, tags }` **sin** `items`. `q` y cada `tag` se combinan |
| `POST /playlists` | `{ name }`. 201 con `items: []` |
| `GET /playlists/{id}` | Detalle. `items` es `[{ position, audioId, audio }]`. `audio` incluye `secondaryTitle` y `tags`. `position` empieza en 1 y puede tener huecos |
| `PATCH /playlists/{id}` | `{ name }`. Responde la playlist con sus items |
| `PUT /playlists/{id}/tags` | `{ "tags": [...] }`. Responde la playlist con items y tags |
| `POST /playlists/{id}/items` | `{ audioId }`. Responde el ítem, no la playlist. La web recarga el detalle |
| `DELETE /playlists/{id}/items/{audioId}` | 204 |
| `PUT /playlists/{id}/items` | `{ "audioIds": [3, 1, 8] }` con exactamente las canciones actuales, cada una una vez |

Los errores son `{ "message", "code" }`. Esta web traduce `FILE_TOO_LARGE` (413), `INVALID_FILE`, `INVALID_ORDER` (400), `INVALID_QUERY` (400, filtro o semilla mal formados) y `RANGE_NOT_SATISFIABLE` (416). La lista de reproducción se ordena por `position`, así que un hueco no cambia el orden ni se confunde con el número de canciones.

## PWA

`manifest.webmanifest`, iconos en `public/icons/` y un service worker mínimo que no guarda caché. Hace falta servir la página por HTTPS (o localhost) para poder instalarla. En el móvil, los controles de bloqueo también dependen de que el navegador acepte Media Session en ese origen.

## Documentación del ecosistema

https://github.com/B3RT1C/audio-streaming
