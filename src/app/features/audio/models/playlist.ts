import { asNumber, asString, isRecord } from '../utils/json';
import { normalizeTagNames } from './tags';
import { normalizeTrack, Track } from './track';

/**
 * Playlist wire format from audio-streaming-backend 0.3.0.
 *
 * GET /playlists returns summaries: { id, name, createdAt, updatedAt, itemCount, tags } and omits items.
 * GET/POST/PATCH /playlists/{id}, PUT /playlists/{id}/items and PUT /playlists/{id}/tags return items.
 * Each item is { position, audioId, audio }. position is 1-based and may contain gaps.
 * audio includes secondaryTitle and tags. POST /playlists/{id}/items returns that item, not the playlist.
 */
export interface PlaylistItem {
  position: number;
  audioId: number;
  audio: Track | null;
}

export interface Playlist {
  id: number;
  name: string;
  /** Track count. Summaries only have this; a loaded playlist also has items. */
  itemCount: number;
  /**
   * null when the payload omitted items (the list endpoint).
   * [] means the playlist was loaded and is empty.
   */
  items: PlaylistItem[] | null;
  tags: string[];
}

export function normalizePlaylistList(raw: unknown): Playlist[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(normalizePlaylist).filter((playlist): playlist is Playlist => playlist != null);
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
  const items = normalizeItems(raw['items']);
  const reported = asNumber(raw['itemCount']);
  const itemCount = items != null ? items.length : (reported ?? 0);
  return { id, name, itemCount, items, tags: normalizeTagNames(raw['tags']) };
}

/** Body of POST /playlists/{id}/items: { position, audioId, audio }. */
export function normalizePlaylistItem(raw: unknown, index = 0): PlaylistItem | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { position: index + 1, audioId: raw, audio: null };
  }
  if (!isRecord(raw)) {
    return null;
  }
  const nested = isRecord(raw['audio']) ? normalizeTrack(raw['audio']) : null;
  const audioId = asNumber(raw['audioId']) ?? nested?.id ?? null;
  if (audioId == null) {
    return null;
  }
  const position = asNumber(raw['position']) ?? index + 1;
  return { position, audioId, audio: nested };
}

function normalizeItems(raw: unknown): PlaylistItem[] | null {
  if (raw == null) {
    return null;
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const items: PlaylistItem[] = [];
  raw.forEach((entry, index) => {
    const item = normalizePlaylistItem(entry, index);
    if (item) {
      items.push(item);
    }
  });
  return items.sort((left, right) => left.position - right.position || left.audioId - right.audioId);
}
