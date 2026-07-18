# Audio Streaming Web

Cliente web del ecosistema [audio-streaming](https://github.com/B3RT1C/audio-streaming).

- Repo: https://github.com/B3RT1C/audio-streaming-web
- Stack: Angular 21, TypeScript, SCSS
- API esperada: `http://localhost:8080` (configurable en `src/environments/`)

## Requisitos

- Node.js 24+
- npm 11+
- Backend en marcha ([audio-streaming-backend](https://github.com/B3RT1C/audio-streaming-backend))

## Arranque

```bash
npm install
npm start
```

UI en `http://localhost:4200`.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm start` | Dev server |
| `npm run build` | Build de producción |
| `npm test` | Tests unitarios |

## Funcionalidad v0.1.0

- Listar y reproducir canciones (streaming desde el back)
- Controles previous / play-pause / stop / next
- Subir MP3 (selector + drag & drop)
- Borrar canciones
- Feedback de carga, vacío y errores (p. ej. nombre duplicado)

## Configuración

URL del API en:

- `src/environments/environment.ts` (desarrollo)
- `src/environments/environment.prod.ts` (producción)

## Documentación del ecosistema

https://github.com/B3RT1C/audio-streaming
