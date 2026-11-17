# Changelog

## 0.4.2

- Pulido visual: chips del buscador con el valor en texto legible y el tipo como etiqueta, input en su propia línea, autocompletado con la misma tipografía y etiquetas derivadas completas en el editor.
- La pestaña inferior dice Etiquetas. La clave de un tipo propio se genera desde el nombre y queda en opciones avanzadas.
- `GET /tags` puede traer `type` como objeto `{ id, key, name, system }`. La vista agrupa por `type.key` y no pinta de golpe los miles de etiquetas de género, álbum o año.

## 0.4.1

- Buscador unificado con prefijos (`artista:`, `género:`, `álbum:`, `año:`, `idioma:`, `playlist:`, la clave de un tipo propio y `#etiqueta`), autocompletado agrupado por tipo y chips de color.
- Esos filtros viajan en la query (`f`) y se combinan con la búsqueda, el aleatorio y los filtros de 0.4.0.
- Editor de etiquetas agrupado por tipo. Género, álbum y año se ven y no se pueden cambiar.
- Vista de etiquetas por tipos, con candado en los de sistema y alta, renombre y borrado (con confirmación) de los propios.

## 0.4.0

- Filtros combinados de título, artista y etiquetas, chips, query string y reproducción aleatoria.
- Vistas de artistas y de etiquetas.

## 0.3.0

- Título secundario, catálogo de artistas y etiquetas en canciones, artistas y listas.

## 0.2.0

- Biblioteca, listas, subida y reproductor en el móvil.
