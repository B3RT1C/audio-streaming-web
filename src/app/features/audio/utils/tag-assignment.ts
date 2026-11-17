import { isRecord, asString } from '../utils/json';
import { isDerivedType, typeKeyOf } from './filter-tokens';

/** One tag attached to a track, artist or playlist. */
export interface AssignedTag {
  name: string;
  type: string;
  readOnly: boolean;
}

/** A name alone is a free tag. An object assigns a specific type. */
export type TagWrite = string | { type: string; name: string };

export function cleanTagName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function isTagLocked(tag: AssignedTag): boolean {
  return tag.readOnly || isDerivedType(tag.type) || tag.type === 'artist';
}

/**
 * Accepts the 0.3 string list and 0.4.1 objects `{ type, name, readOnly }`.
 * `type` may be a key or `{ key }`, the same shape as GET /tags.
 */
export function normalizeAssignedTags(raw: unknown): AssignedTag[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: AssignedTag[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const name = cleanTagName(entry);
      if (name) {
        result.push({ name, type: 'free', readOnly: false });
      }
      continue;
    }
    if (!isRecord(entry)) {
      continue;
    }
    const name = cleanTagName(asString(entry['name']) ?? '');
    if (!name) {
      continue;
    }
    const type = cleanTagName(typeKeyOf(entry['type']) || typeKeyOf(entry['typeKey'])) || 'free';
    const readOnly = entry['readOnly'] === true || isDerivedType(type) || type === 'artist';
    result.push({ name, type, readOnly });
  }
  return result;
}

export function assignedNames(tags: readonly AssignedTag[]): string[] {
  return tags.map((tag) => tag.name);
}

export function namesToAssigned(names: readonly string[]): AssignedTag[] {
  return names
    .map((name) => cleanTagName(name))
    .filter((name) => name.length > 0)
    .map((name) => ({ name, type: 'free', readOnly: false }));
}

/**
 * Body of PUT /audios|artists|playlists/{id}/tags.
 * Derived tags (genre, album, year), the virtual artist type and read-only
 * tags are left out: the server keeps them and rejects a manual assign with 400.
 */
export function assignmentPayload(tags: readonly AssignedTag[]): TagWrite[] {
  const result: TagWrite[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (isTagLocked(tag)) {
      continue;
    }
    const name = cleanTagName(tag.name);
    if (!name || name.length > 100) {
      continue;
    }
    const type = tag.type.trim() || 'free';
    const key = `${type}\u0000${name.toLocaleLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(type === 'free' ? name : { type, name });
    if (result.length >= 100) {
      break;
    }
  }
  return result;
}

export function sameAssigned(left: AssignedTag, right: AssignedTag): boolean {
  return left.type === right.type && left.name.trim().toLocaleLowerCase() === right.name.trim().toLocaleLowerCase();
}
