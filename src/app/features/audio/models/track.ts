import { asNumber, asString, isRecord } from '../utils/json';

/**
 * Catalog row. 0.1 fields stay, and 0.2 adds title, artist, album,
 * durationSeconds and trackNumber. Adjust `normalizeTrack` if the wire names move.
 */
export interface Track {
  id: number;
  path: string;
  name: string;
  extension: string;
  contentHash?: string;
  checksum?: string;
  updatedAt?: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  durationSeconds: number | null;
  trackNumber: number | null;
}

/** Body of PATCH /audios/{id}. Null trackNumber clears the value. */
export interface TrackMetadataPatch {
  title: string;
  artist: string;
  album: string;
  trackNumber: number | null;
}

export interface TrackRow {
  audioId: number;
  track: Track | null;
}

export const API_PATHS = {
  audios: '/audios',
  playlists: '/playlists',
  syncStatus: '/sync/status',
} as const;

export function normalizeTrackList(raw: unknown): Track[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map(normalizeTrack).filter((track): track is Track => track != null);
}

export function normalizeTrack(raw: unknown): Track | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asNumber(raw['id']);
  if (id == null) {
    return null;
  }
  const name = asString(raw['name']) ?? asString(raw['title']) ?? '';
  return {
    id,
    path: asString(raw['path']) ?? '',
    name,
    extension: asString(raw['extension']) ?? '',
    contentHash: asString(raw['contentHash']) ?? undefined,
    checksum: asString(raw['checksum']) ?? undefined,
    updatedAt: asString(raw['updatedAt']) ?? undefined,
    title: asString(raw['title']),
    artist: asString(raw['artist']),
    album: asString(raw['album']),
    durationSeconds: asNumber(raw['durationSeconds']),
    trackNumber: asNumber(raw['trackNumber']),
  };
}

export function trackTitle(track: Track | null | undefined): string {
  if (!track) {
    return 'Sin título';
  }
  const title = track.title?.trim();
  if (title) {
    return title;
  }
  const name = track.name?.trim();
  return name || 'Sin título';
}

export function trackSubtitle(track: Track | null | undefined): string {
  if (!track) {
    return '';
  }
  const artist = track.artist?.trim() ?? '';
  const album = track.album?.trim() ?? '';
  if (artist && album) {
    return `${artist} · ${album}`;
  }
  return artist || album;
}
