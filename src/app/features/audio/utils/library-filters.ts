import { sameTag } from '../models/tags';

/** Filters for GET /audios. Every field combines with AND. Blanks are omitted. */
export interface LibraryFilters {
  q: string;
  title: string;
  artist: string;
  tags: string[];
  artistTags: string[];
  playlistTags: string[];
}

/** Filters for GET /playlists and GET /artists (`q` plus repeated `tag`). */
export interface NameTagFilters {
  q: string;
  tags: string[];
}

export type LibraryView = 'home' | 'search' | 'playlists' | 'artists' | 'tags';

export interface ViewState {
  view: LibraryView;
  playlistId: number | null;
  library: LibraryFilters;
  playlists: NameTagFilters;
  artists: NameTagFilters;
}

export interface FilterChip {
  group: 'library' | 'playlists' | 'artists';
  key: 'q' | 'title' | 'artist' | 'tag' | 'artistTag' | 'playlistTag';
  value: string;
  label: string;
}

export interface ShuffleRequest {
  seed?: number;
}

const VIEWS: readonly LibraryView[] = ['home', 'search', 'playlists', 'artists', 'tags'];

export function emptyLibraryFilters(): LibraryFilters {
  return { q: '', title: '', artist: '', tags: [], artistTags: [], playlistTags: [] };
}

export function emptyNameTagFilters(): NameTagFilters {
  return { q: '', tags: [] };
}

export function emptyViewState(): ViewState {
  return {
    view: 'home',
    playlistId: null,
    library: emptyLibraryFilters(),
    playlists: emptyNameTagFilters(),
    artists: emptyNameTagFilters(),
  };
}

export function uniqueTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const clean = tag.trim().replace(/\s+/g, ' ');
    if (!clean) {
      continue;
    }
    const key = clean.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(clean);
  }
  return result;
}

export function libraryFiltersActive(filters: LibraryFilters): boolean {
  return Boolean(
    filters.q.trim() ||
      filters.title.trim() ||
      filters.artist.trim() ||
      filters.tags.length ||
      filters.artistTags.length ||
      filters.playlistTags.length,
  );
}

export function nameTagFiltersActive(filters: NameTagFilters): boolean {
  return Boolean(filters.q.trim() || filters.tags.length);
}

/** Query string for GET /audios. Repeated tags stay repeated. Empty values are left out. */
export function audioSearchParams(filters: LibraryFilters, shuffle?: ShuffleRequest): URLSearchParams {
  const params = new URLSearchParams();
  appendText(params, 'q', filters.q);
  appendText(params, 'title', filters.title);
  appendText(params, 'artist', filters.artist);
  appendTags(params, 'tag', filters.tags);
  appendTags(params, 'artistTag', filters.artistTags);
  appendTags(params, 'playlistTag', filters.playlistTags);
  if (shuffle) {
    params.set('shuffle', 'true');
    if (shuffle.seed != null && Number.isInteger(shuffle.seed)) {
      params.set('seed', String(shuffle.seed));
    }
  }
  return params;
}

/** Query string for GET /playlists and GET /artists. */
export function catalogSearchParams(filters: NameTagFilters): URLSearchParams {
  const params = new URLSearchParams();
  appendText(params, 'q', filters.q);
  appendTags(params, 'tag', filters.tags);
  return params;
}

export function libraryChips(filters: LibraryFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  const q = filters.q.trim();
  const title = filters.title.trim();
  const artist = filters.artist.trim();
  if (q) {
    chips.push({ group: 'library', key: 'q', value: q, label: `Búsqueda: ${q}` });
  }
  if (title) {
    chips.push({ group: 'library', key: 'title', value: title, label: `Título: ${title}` });
  }
  if (artist) {
    chips.push({ group: 'library', key: 'artist', value: artist, label: `Artista: ${artist}` });
  }
  for (const tag of filters.tags) {
    chips.push({ group: 'library', key: 'tag', value: tag, label: `Canción: ${tag}` });
  }
  for (const tag of filters.artistTags) {
    chips.push({ group: 'library', key: 'artistTag', value: tag, label: `Etiqueta de artista: ${tag}` });
  }
  for (const tag of filters.playlistTags) {
    chips.push({ group: 'library', key: 'playlistTag', value: tag, label: `Etiqueta de lista: ${tag}` });
  }
  return chips;
}

export function nameTagChips(filters: NameTagFilters, group: 'playlists' | 'artists'): FilterChip[] {
  const chips: FilterChip[] = [];
  const q = filters.q.trim();
  if (q) {
    chips.push({ group, key: 'q', value: q, label: `Nombre: ${q}` });
  }
  for (const tag of filters.tags) {
    chips.push({ group, key: 'tag', value: tag, label: tag });
  }
  return chips;
}

export function withoutLibraryChip(filters: LibraryFilters, chip: FilterChip): LibraryFilters {
  if (chip.key === 'q') {
    return { ...filters, q: '' };
  }
  if (chip.key === 'title') {
    return { ...filters, title: '' };
  }
  if (chip.key === 'artist') {
    return { ...filters, artist: '' };
  }
  if (chip.key === 'tag') {
    return { ...filters, tags: filters.tags.filter((tag) => !sameTag(tag, chip.value)) };
  }
  if (chip.key === 'artistTag') {
    return { ...filters, artistTags: filters.artistTags.filter((tag) => !sameTag(tag, chip.value)) };
  }
  return { ...filters, playlistTags: filters.playlistTags.filter((tag) => !sameTag(tag, chip.value)) };
}

export function withoutNameTagChip(filters: NameTagFilters, chip: FilterChip): NameTagFilters {
  if (chip.key === 'q') {
    return { ...filters, q: '' };
  }
  return { ...filters, tags: filters.tags.filter((tag) => !sameTag(tag, chip.value)) };
}

export function sameLibraryFilters(left: LibraryFilters, right: LibraryFilters): boolean {
  return (
    left.q.trim() === right.q.trim() &&
    left.title.trim() === right.title.trim() &&
    left.artist.trim() === right.artist.trim() &&
    sameTagList(left.tags, right.tags) &&
    sameTagList(left.artistTags, right.artistTags) &&
    sameTagList(left.playlistTags, right.playlistTags)
  );
}

export function sameNameTagFilters(left: NameTagFilters, right: NameTagFilters): boolean {
  return left.q.trim() === right.q.trim() && sameTagList(left.tags, right.tags);
}

/** Text fields changed while the tag sets stayed the same. Those edits are debounced. */
export function libraryTextOnlyChange(previous: LibraryFilters, next: LibraryFilters): boolean {
  return (
    !sameLibraryFilters(previous, next) &&
    sameTagList(previous.tags, next.tags) &&
    sameTagList(previous.artistTags, next.artistTags) &&
    sameTagList(previous.playlistTags, next.playlistTags)
  );
}

export function viewToSearch(state: ViewState): string {
  const params = new URLSearchParams();
  if (state.playlistId != null) {
    params.set('view', 'playlists');
    params.set('playlist', String(state.playlistId));
  } else if (state.view !== 'home') {
    params.set('view', state.view);
  }
  appendAll(params, audioSearchParams(state.library));
  appendText(params, 'pq', state.playlists.q);
  appendTags(params, 'ptag', state.playlists.tags);
  appendText(params, 'aq', state.artists.q);
  appendTags(params, 'atag', state.artists.tags);
  return params.toString();
}

export function viewFromSearch(search: string): ViewState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const playlistRaw = params.get('playlist');
  const playlistId = playlistRaw != null && /^\d+$/.test(playlistRaw) ? Number(playlistRaw) : null;
  const viewRaw = params.get('view');
  const view = playlistId != null ? 'playlists' : isView(viewRaw) ? viewRaw : 'home';
  return {
    view,
    playlistId,
    library: {
      q: params.get('q')?.trim() ?? '',
      title: params.get('title')?.trim() ?? '',
      artist: params.get('artist')?.trim() ?? '',
      tags: uniqueTags(params.getAll('tag')),
      artistTags: uniqueTags(params.getAll('artistTag')),
      playlistTags: uniqueTags(params.getAll('playlistTag')),
    },
    playlists: {
      q: params.get('pq')?.trim() ?? '',
      tags: uniqueTags(params.getAll('ptag')),
    },
    artists: {
      q: params.get('aq')?.trim() ?? '',
      tags: uniqueTags(params.getAll('atag')),
    },
  };
}

/** Replaces the query string and returns the search that was written (without `?`). */
export function writeViewSearch(state: ViewState, locationLike: Pick<Location, 'pathname' | 'search'> = location): string {
  const search = viewToSearch(state);
  const next = search ? `?${search}` : '';
  if (locationLike.search !== next && typeof history !== 'undefined') {
    history.replaceState(history.state, '', `${locationLike.pathname}${next}`);
  }
  return search;
}

function appendAll(target: URLSearchParams, source: URLSearchParams): void {
  source.forEach((value, key) => target.append(key, value));
}

function appendText(params: URLSearchParams, key: string, value: string): void {
  const trimmed = value.trim();
  if (trimmed) {
    params.set(key, trimmed);
  }
}

function appendTags(params: URLSearchParams, key: string, tags: readonly string[]): void {
  for (const tag of uniqueTags(tags)) {
    params.append(key, tag);
  }
}

function sameTagList(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((tag, index) => sameTag(tag, right[index] ?? ''));
}

function isView(value: string | null): value is LibraryView {
  return value != null && (VIEWS as readonly string[]).includes(value);
}
