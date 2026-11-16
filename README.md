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

El `main` del backend, en el momento de este cliente, sigue en el contrato 0.1.0. Esta web ya llama a la 0.2.0. Si un nombre no coincide, el ajuste está en un solo sitio:

- Canciones: `src/app/features/audio/models/track.ts` (`normalizeTrack`)
- Listas: `src/app/features/audio/models/playlist.ts` (`normalizePlaylist`)
- Cuerpos de las peticiones: `audio-service.ts` y `playlist-service.ts`

Se asume:

| Petición | Cuerpo / respuesta |
|----------|--------------------|
| `GET /audios` y `GET /audios?q=` | Array como en 0.1, más `title`, `artist`, `album`, `durationSeconds`, `trackNumber` |
| `PATCH /audios/{id}` | `{ title, artist, album, trackNumber }` (`trackNumber` puede ser `null`) |
| `GET /audios/{id}` y `POST /audios` | Igual que en 0.1 (`file` y `name` opcional) |
| `GET /playlists` | Array de `{ id, name, items? }` |
| `POST /playlists` | `{ name }` |
| `GET /playlists/{id}` | `{ id, name, items }` |
| `PATCH /playlists/{id}` | `{ name }` |
| `POST /playlists/{id}/items` | `{ audioId }` |
| `DELETE /playlists/{id}/items/{audioId}` | sin cuerpo |
| `PUT /playlists/{id}/items` | array ordenado de ids, por ejemplo `[3, 1, 8]` |

`items` puede ser `[{ audioId, position? }]` o una lista de números. Los ids son numéricos.

## PWA

`manifest.webmanifest`, iconos en `public/icons/` y un service worker mínimo que no guarda caché. Hace falta servir la página por HTTPS (o localhost) para poder instalarla. En el móvil, los controles de bloqueo también dependen de que el navegador acepte Media Session en ese origen.

## Documentación del ecosistema

https://github.com/B3RT1C/audio-streaming
