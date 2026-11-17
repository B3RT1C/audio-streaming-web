import { asNumber, asString, isRecord } from '../utils/json';
import { canonicalType } from '../utils/filter-tokens';
import { AssignedTag, assignedNames, normalizeAssignedTags } from '../utils/tag-assignment';

/** GET /artists row. The name matches audio.artist exactly, including case and spaces. */
export interface Artist {
  id: number;
  name: string;
  audioCount: number;
  tags: string[];
  tagItems?: AssignedTag[];
}

/** GET /tags row. Counts are independent. `type` defaults to free. */
export interface TagSummary {
  id: number;
  name: string;
  type: string;
  readOnly: boolean;
  audioCount: number;
  artistCount: number;
  playlistCount: number;
}

/** GET /tag-types row. System types cannot be renamed or deleted. */
export interface TagType {
  id: number;
  key: string;
  name: string;
  system: boolean;
  color: string | null;
  tagCount: number;
  audioCount: number;
  artistCount: number;
  playlistCount: number;
}

/** GET /filter/suggest row. */
export interface FilterSuggestion {
  type: string;
  value: string;
  count: number;
}

export interface TagTypeDraft {
  name: string;
  key?: string;
  color?: string | null;
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
  const tagItems = normalizeAssignedTags(raw['tags']);
  return {
    id,
    name,
    audioCount: Math.max(0, asNumber(raw['audioCount']) ?? 0),
    tags: assignedNames(tagItems),
    tagItems,
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
  const type = canonicalType(asString(raw['type']) ?? asString(raw['typeKey']) ?? 'free');
  return {
    id,
    name,
    type,
    readOnly: raw['readOnly'] === true || type === 'genre' || type === 'album' || type === 'year' || type === 'artist',
    audioCount: Math.max(0, asNumber(raw['audioCount']) ?? 0),
    artistCount: Math.max(0, asNumber(raw['artistCount']) ?? 0),
    playlistCount: Math.max(0, asNumber(raw['playlistCount']) ?? 0),
  };
}

export function normalizeTagTypeList(raw: unknown): TagType[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(normalizeTagType).filter((type): type is TagType => type != null);
}

export function normalizeTagType(raw: unknown): TagType | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asNumber(raw['id']);
  const name = asString(raw['name'])?.trim().replace(/\s+/g, ' ') ?? '';
  const key = (asString(raw['key']) ?? '').trim();
  if (id == null || !key) {
    return null;
  }
  const counts = isRecord(raw['counts']) ? raw['counts'] : isRecord(raw['conteos']) ? raw['conteos'] : raw;
  const color = asString(raw['color'])?.trim() ?? '';
  return {
    id,
    key,
    name: name || key,
    system: raw['system'] === true,
    color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : null,
    tagCount: countOf(counts, 'tagCount', 'tags', 'count'),
    audioCount: countOf(counts, 'audioCount', 'audios'),
    artistCount: countOf(counts, 'artistCount', 'artists'),
    playlistCount: countOf(counts, 'playlistCount', 'playlists'),
  };
}

export function normalizeSuggestions(raw: unknown): FilterSuggestion[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: FilterSuggestion[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) {
      continue;
    }
    const value = asString(entry['value'])?.trim().replace(/\s+/g, ' ') ?? '';
    if (!value) {
      continue;
    }
    const type = canonicalType(asString(entry['type']) ?? asString(entry['typeKey']) ?? asString(entry['prefix']) ?? 'free');
    result.push({
      type,
      value,
      count: Math.max(0, asNumber(entry['count']) ?? asNumber(entry['audioCount']) ?? 0),
    });
  }
  return result;
}

function countOf(raw: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = asNumber(raw[key]);
    if (value != null) {
      return Math.max(0, value);
    }
  }
  return 0;
}
