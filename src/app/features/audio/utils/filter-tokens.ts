/**
 * Unified library filters (`GET /audios?f=`).
 * A token is `prefijo:valor`, `#valor` or a bare free-tag name.
 * Prefixes match with or without accents; the serialized form keeps the accent.
 */

export interface FilterToken {
  /** artist, genre, album, year, language, playlist, free, or a user type key. */
  type: string;
  value: string;
}

export interface TokenPrefix {
  type: string;
  /** Text written before the colon, or `#` for free tags. */
  prefix: string;
  label: string;
}

interface PrefixRule extends TokenPrefix {
  aliases: readonly string[];
}

const RULES: readonly PrefixRule[] = [
  { type: 'artist', prefix: 'artista', label: 'Artista', aliases: ['artist'] },
  { type: 'genre', prefix: 'género', label: 'Género', aliases: ['genre'] },
  { type: 'album', prefix: 'álbum', label: 'Álbum', aliases: [] },
  { type: 'year', prefix: 'año', label: 'Año', aliases: ['year'] },
  { type: 'language', prefix: 'idioma', label: 'Idioma', aliases: ['language'] },
  { type: 'playlist', prefix: 'playlist', label: 'Playlist', aliases: ['lista'] },
];

export const SYSTEM_TYPE_ORDER = ['artist', 'genre', 'album', 'year', 'language', 'free'] as const;

export const DERIVED_TYPE_KEYS = ['genre', 'album', 'year'] as const;

const DEFAULT_TYPE_COLOR: Record<string, string> = {
  artist: '#8eb6ff',
  genre: '#f0c14b',
  album: '#c4b5fd',
  year: '#86efac',
  language: '#67e8f9',
  playlist: '#fda4af',
  free: '#d4d4d8',
};

const FALLBACK_COLORS = ['#f9a8d4', '#fdba74', '#a5b4fc', '#5eead4', '#fcd34d', '#fca5a5'];

export function foldAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

export function isDerivedType(type: string): boolean {
  return (DERIVED_TYPE_KEYS as readonly string[]).includes(type);
}

export function typeLabel(type: string, known: readonly { key: string; name: string }[] = []): string {
  const match = known.find((item) => item.key === type);
  if (match?.name.trim()) {
    return match.name.trim();
  }
  return RULES.find((rule) => rule.type === type)?.label ?? (type === 'free' ? 'Libre' : type);
}

export function typeColor(type: string, known: readonly { key: string; color?: string | null }[] = []): string {
  const match = known.find((item) => item.key === type)?.color?.trim();
  if (match && /^#[0-9a-fA-F]{6}$/.test(match)) {
    return match;
  }
  if (DEFAULT_TYPE_COLOR[type]) {
    return DEFAULT_TYPE_COLOR[type];
  }
  const folded = foldAccents(type);
  let hash = 0;
  for (let index = 0; index < folded.length; index += 1) {
    hash = (hash + folded.charCodeAt(index) * (index + 1)) % FALLBACK_COLORS.length;
  }
  return FALLBACK_COLORS[hash] ?? FALLBACK_COLORS[0];
}

export function prefixRules(): readonly TokenPrefix[] {
  return RULES.map(({ type, prefix, label }) => ({ type, prefix, label }));
}

/** Canonical token text. Free tags always use the `#` form. */
export function serializeFilterToken(token: FilterToken): string {
  const value = token.value.trim().replace(/\s+/g, ' ');
  if (!value) {
    return '';
  }
  if (token.type === 'free') {
    return `#${value}`;
  }
  const rule = RULES.find((item) => item.type === token.type);
  const prefix = rule?.prefix ?? token.type;
  return `${prefix}:${value}`;
}

/**
 * Reads one token. `genero:rock` and `género:rock` are the same filter.
 * A bare value and `#valor` are both free tags. An empty value is ignored.
 */
export function parseFilterToken(raw: string, customKeys: readonly string[] = []): FilterToken | null {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) {
    return null;
  }
  if (text.startsWith('#')) {
    const value = text.slice(1).trim().replace(/\s+/g, ' ');
    return value ? { type: 'free', value } : null;
  }
  const colon = text.indexOf(':');
  if (colon > 0) {
    const prefix = text.slice(0, colon).trim();
    const value = text.slice(colon + 1).trim().replace(/\s+/g, ' ');
    if (!prefix || !value) {
      return null;
    }
    return { type: resolvePrefix(prefix, customKeys), value };
  }
  return { type: 'free', value: text };
}

export function sameFilterToken(left: FilterToken, right: FilterToken): boolean {
  return left.type === right.type && left.value.trim().toLocaleLowerCase() === right.value.trim().toLocaleLowerCase();
}

export function uniqueTokens(tokens: readonly FilterToken[] | null | undefined): FilterToken[] {
  const result: FilterToken[] = [];
  for (const token of tokens ?? []) {
    const value = token.value.trim().replace(/\s+/g, ' ');
    if (!value) {
      continue;
    }
    const next = { type: token.type || 'free', value };
    if (result.some((item) => sameFilterToken(item, next))) {
      continue;
    }
    result.push(next);
  }
  return result;
}

export interface DraftParts {
  kind: 'text' | 'hash' | 'prefixed';
  /** Raw prefix as typed, `#` for a free tag, or empty for plain text. */
  prefix: string;
  q: string;
}

/** Splits the text still being typed. Does not commit a token. */
export function inspectDraft(raw: string): DraftParts {
  const trimmed = raw.trim();
  if (trimmed.startsWith('#')) {
    return { kind: 'hash', prefix: '#', q: trimmed.slice(1).trim() };
  }
  const colon = trimmed.indexOf(':');
  if (colon > 0) {
    return {
      kind: 'prefixed',
      prefix: trimmed.slice(0, colon).trim(),
      q: trimmed.slice(colon + 1).trim(),
    };
  }
  return { kind: 'text', prefix: '', q: trimmed };
}

/** Prefixes the current word could still become, including user type keys. */
export function matchingPrefixes(
  draft: string,
  custom: readonly { key: string; name: string }[] = [],
): TokenPrefix[] {
  const parts = inspectDraft(draft);
  if (parts.kind !== 'text' || !parts.q) {
    return [];
  }
  const folded = foldAccents(parts.q);
  const system = RULES.filter((rule) => {
    const names = [rule.prefix, rule.label, ...rule.aliases];
    return names.some((name) => foldAccents(name).startsWith(folded));
  }).map(({ type, prefix, label }) => ({ type, prefix, label }));
  const extra = custom
    .filter((item) => {
      const key = item.key.trim();
      if (!key || RULES.some((rule) => rule.type === key)) {
        return false;
      }
      return foldAccents(key).startsWith(folded) || foldAccents(item.name).startsWith(folded);
    })
    .map((item) => ({ type: item.key, prefix: item.key, label: item.name.trim() || item.key }));
  return [...system, ...extra];
}

export function canonicalType(raw: string, customKeys: readonly string[] = []): string {
  const text = raw.trim();
  if (!text || text === '#' || foldAccents(text) === 'libre' || foldAccents(text) === 'free') {
    return 'free';
  }
  return resolvePrefix(text, customKeys);
}

export function tokenForTag(tag: { type?: string | null; name: string }, customKeys: readonly string[] = []): FilterToken {
  const type = tag.type?.trim() ? canonicalType(tag.type, customKeys) : 'free';
  return { type, value: tag.name.trim().replace(/\s+/g, ' ') };
}

function resolvePrefix(prefix: string, customKeys: readonly string[]): string {
  const folded = foldAccents(prefix);
  for (const rule of RULES) {
    const names = [rule.prefix, rule.type, rule.label, ...rule.aliases];
    if (names.some((name) => foldAccents(name) === folded)) {
      return rule.type;
    }
  }
  const custom = customKeys.find((key) => foldAccents(key) === folded);
  if (custom) {
    return custom;
  }
  const slug = folded.replace(/[^a-z0-9_-]+/g, '').replace(/^-+|-+$/g, '');
  return slug || 'free';
}
