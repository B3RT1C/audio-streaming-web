import { asNumber, asString, isRecord } from '../utils/json';

/**
 * Assumed 0.2.0 playlist wire format. Change this file if the backend shape differs.
 *
 * - GET /playlists → PlaylistJson[] (or { playlists | content: PlaylistJson[] })
 * - GET/POST/PATCH playlist → PlaylistJson
 * - items → { audioId, position? }[] or a bare number[] of audio ids
 * - POST /playlists body is { name }
 * - PATCH /playlists/{id} body is { name }
 * - POST /playlists/{id}/items body is { audioId }
 * - PUT /playlists/{id}/items body is the ordered audio id list (number[])
 */
export interface PlaylistItemJson {
  audioId?: number;
  position?: number;
  audio?: { id?: number };
  track?: { id?: number };
}

export interface PlaylistJson {
  id?: number;
  name?: string;
  items?: Array<PlaylistItemJson | number>;
  tracks?: Array<PlaylistItemJson | number>;
  audios?: Array<PlaylistItemJson | number>;
}

export interface PlaylistItem {
  audioId: number;
  position: number;
}

export interface Playlist {
  id: number;
  name: string;
  items: PlaylistItem[];
}

export function normalizePlaylistList(raw: unknown): Playlist[] {
  const list = unwrapList(raw);
  return list.map(normalizePlaylist).filter((playlist): playlist is Playlist => playlist != null);
}

export function normalizePlaylist(raw: unknown): Playlist | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asNumber(raw['id']);
  if (id == null) {
    return null;
  }
  const name = asString(raw['name'])?.trim() || 'Sin nombre';
  const items = normalizeItems(raw['items'] ?? raw['tracks'] ?? raw['audios']);
  return { id, name, items };
}

function unwrapList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (!isRecord(raw)) {
    return [];
  }
  if (Array.isArray(raw['playlists'])) {
    return raw['playlists'];
  }
  if (Array.isArray(raw['content'])) {
    return raw['content'];
  }
  return [];
}

function normalizeItems(raw: unknown): PlaylistItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const items: PlaylistItem[] = [];
  raw.forEach((entry, index) => {
    const audioId = itemAudioId(entry);
    if (audioId == null) {
      return;
    }
    const position = isRecord(entry) ? (asNumber(entry['position']) ?? index) : index;
    items.push({ audioId, position });
  });
  return items.sort((a, b) => a.position - b.position || a.audioId - b.audioId);
}

function itemAudioId(entry: unknown): number | null {
  if (typeof entry === 'number' && Number.isFinite(entry)) {
    return entry;
  }
  if (!isRecord(entry)) {
    return null;
  }
  const direct = asNumber(entry['audioId']);
  if (direct != null) {
    return direct;
  }
  if (isRecord(entry['audio'])) {
    const nested = asNumber(entry['audio']['id']);
    if (nested != null) {
      return nested;
    }
  }
  if (isRecord(entry['track'])) {
    return asNumber(entry['track']['id']);
  }
  return null;
}
