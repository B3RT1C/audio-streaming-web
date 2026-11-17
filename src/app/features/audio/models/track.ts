import { asNumber, asString, isRecord } from '../utils/json';
import { AssignedTag, assignedNames, normalizeAssignedTags, TagWrite } from '../utils/tag-assignment';

/**
 * Catalog row. 0.1 fields stay. 0.2 adds title, artist, album, duration and
 * track number. 0.3 adds secondaryTitle and tags. 0.4 filters are query
 * parameters, not new fields on the track. Adjust `normalizeTrack` if
 * the wire names move.
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
  secondaryTitle: string | null;
  artist: string | null;
  album: string | null;
  durationSeconds: number | null;
  trackNumber: number | null;
  tags: string[];
  /** Typed tags when the API sends them. Plain names stay free tags. */
  tagItems?: AssignedTag[];
}

/**
 * Body of PATCH /audios/{id}. Omitted fields stay as they are.
 * `secondaryTitle: null` (or a blank string, which the client sends as null) clears it.
 * Tags are not part of this body: use PUT /audios/{id}/tags.
 */
export interface TrackMetadataPatch {
  title?: string;
  secondaryTitle?: string | null;
  artist?: string;
  album?: string;
  trackNumber?: number | null;
}

export interface TrackEdit {
  patch: TrackMetadataPatch;
  /** Editable tag names. Derived tags are not included. */
  tags: string[];
  /** Typed replacement. Free tags are strings; the rest are `{ type, name }`. */
  assignments?: TagWrite[];
}

export interface TrackRow {
  audioId: number;
  track: Track | null;
}

export const API_PATHS = {
  audios: '/audios',
  playlists: '/playlists',
  artists: '/artists',
  tags: '/tags',
  tagTypes: '/tag-types',
  filterSuggest: '/filter/suggest',
  syncStatus: '/sync/status',
  plays: '/plays',
  stats: '/stats',
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
  const tagItems = normalizeAssignedTags(raw['tags']);
  return {
    id,
    path: asString(raw['path']) ?? '',
    name,
    extension: asString(raw['extension']) ?? '',
    contentHash: asString(raw['contentHash']) ?? undefined,
    checksum: asString(raw['checksum']) ?? undefined,
    updatedAt: asString(raw['updatedAt']) ?? undefined,
    title: asString(raw['title']),
    secondaryTitle: blankToNull(asString(raw['secondaryTitle'])),
    artist: asString(raw['artist']),
    album: asString(raw['album']),
    durationSeconds: asNumber(raw['durationSeconds']),
    trackNumber: asNumber(raw['trackNumber']),
    tags: assignedNames(tagItems),
    tagItems,
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

export function trackSecondary(track: Track | null | undefined): string {
  return track?.secondaryTitle?.trim() ?? '';
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

function blankToNull(value: string | null): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
