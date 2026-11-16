# Audio Streaming Web

Cliente web del ecosistema [audio-streaming](https://github.com/B3RT1C/audio-streaming). Versión **0.2.0**.

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

## Funcionalidad 0.2.0

- Biblioteca con título, artista, álbum, número de pista y duración
- Buscador con espera de 300 ms (`GET /audios?q=`)
- Edición de título, artista, álbum y número de pista
- Listas: crear, renombrar, borrar, añadir, quitar y reordenar
- Reproducir la biblioteca o una lista, con cola, anterior, siguiente, aleatorio y repetir
- Barra de progreso con salto
- Controles de la pantalla de bloqueo (Media Session), cuando el navegador lo permite
- Subida con barra de progreso, hasta 500 MB, y aviso si el archivo no es audio o se pasa del límite
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

Alineado con el backend 0.2.0 (`docs/openapi.yaml` de la rama `cursor/backend-0-2-0-7e11`). Si un nombre cambia, el ajuste está en un solo sitio:

- Canciones: `src/app/features/audio/models/track.ts` (`normalizeTrack`)
- Listas: `src/app/features/audio/models/playlist.ts` (`normalizePlaylist`)
- Cuerpos de las peticiones: `audio-service.ts` y `playlist-service.ts`
- Textos de error: `src/app/features/audio/utils/api-error.ts`

| Petición | Cuerpo / respuesta |
|----------|--------------------|
| `GET /audios` y `GET /audios?q=` | Array de canciones, con `title`, `artist`, `album`, `durationSeconds`, `trackNumber` |
| `PATCH /audios/{id}` | `{ title, artist, album, trackNumber }` (`trackNumber` puede ser `null`). Responde la canción |
| `GET /audios/{id}` | Stream. Un rango fuera del fichero responde 416 `RANGE_NOT_SATISFIABLE` |
| `POST /audios` | `file` y `name` opcional. Responde **201** `{ "message": "File received" }` **sin id**. Tras subir, la web vuelve a pedir el listado |
| `GET /playlists` | Resúmenes `{ id, name, createdAt, updatedAt, itemCount }` **sin** `items` |
| `POST /playlists` | `{ name }`. 201 con `items: []` |
| `GET /playlists/{id}` | Detalle. `items` es `[{ position, audioId, audio }]`. `position` empieza en 1 y puede tener huecos |
| `PATCH /playlists/{id}` | `{ name }`. Responde la playlist con sus items |
| `POST /playlists/{id}/items` | `{ audioId }`. Responde el ítem, no la playlist. La web recarga el detalle |
| `DELETE /playlists/{id}/items/{audioId}` | 204 |
| `PUT /playlists/{id}/items` | `{ "audioIds": [3, 1, 8] }` con exactamente las canciones actuales, cada una una vez |

Los errores son `{ "message", "code" }`. Esta web traduce `FILE_TOO_LARGE` (413), `INVALID_FILE`, `INVALID_ORDER` (400) y `RANGE_NOT_SATISFIABLE` (416). La lista de reproducción se ordena por `position`, así que un hueco no cambia el orden ni se confunde con el número de canciones.

## PWA

`manifest.webmanifest`, iconos en `public/icons/` y un service worker mínimo que no guarda caché. Hace falta servir la página por HTTPS (o localhost) para poder instalarla. En el móvil, los controles de bloqueo también dependen de que el navegador acepte Media Session en ese origen.

## Documentación del ecosistema

https://github.com/B3RT1C/audio-streaming
