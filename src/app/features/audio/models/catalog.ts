import { asNumber, asString, isRecord } from '../utils/json';
import { normalizeTagNames } from './tags';

/** GET /artists row. The name matches audio.artist exactly, including case and spaces. */
export interface Artist {
  id: number;
  name: string;
  audioCount: number;
  tags: string[];
}

/** GET /tags row. Counts are independent. */
export interface TagSummary {
  id: number;
  name: string;
  audioCount: number;
  artistCount: number;
  playlistCount: number;
}

export function normalizeArtistList(raw: unknown): Artist[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(normalizeArtist).filter((artist): artist is Artist => artist != null);
}

export function normalizeArtist(raw: unknown): Artist | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asNumber(raw['id']);
  const name = asString(raw['name']);
  if (id == null || name == null || name.trim() === '') {
    return null;
  }
  return {
    id,
    name,
    audioCount: Math.max(0, asNumber(raw['audioCount']) ?? 0),
    tags: normalizeTagNames(raw['tags']),
  };
}

export function normalizeTagList(raw: unknown): TagSummary[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(normalizeTagSummary).filter((tag): tag is TagSummary => tag != null);
}

export function normalizeTagSummary(raw: unknown): TagSummary | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asNumber(raw['id']);
  const name = asString(raw['name'])?.trim().replace(/\s+/g, ' ') ?? '';
  if (id == null || !name) {
    return null;
  }
  return {
    id,
    name,
    audioCount: Math.max(0, asNumber(raw['audioCount']) ?? 0),
    artistCount: Math.max(0, asNumber(raw['artistCount']) ?? 0),
    playlistCount: Math.max(0, asNumber(raw['playlistCount']) ?? 0),
  };
}
