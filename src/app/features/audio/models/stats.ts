import { asNumber, isRecord } from '../utils/json';

export interface StatsSummary {
  plays: number;
  listenedSeconds: number;
  distinctAudios: number;
  distinctArtists: number;
  from?: string;
  to?: string;
}

export interface StatsRank {
  id: number;
  /** Shown as returned. Titles and artist names are not rewritten. */
  name: string;
  secondaryName?: string;
  plays: number;
  listenedSeconds: number;
  /** Tag type key used to request this row. Not part of the wire payload. */
  tagType?: string;
}

export interface StatsBucket {
  period: string;
  plays: number;
  listenedSeconds: number;
}

export type StatsKind = 'audio' | 'artist' | 'tag' | 'playlist';

export type StatsTagFilter = 'genre' | 'album' | 'year' | 'language' | 'custom';

export function normalizeStatsSummary(raw: unknown): StatsSummary | null {
  if (!isRecord(raw)) {
    return null;
  }
  const plays = asNumber(raw['plays']);
  const listenedSeconds = asNumber(raw['listenedSeconds']);
  const distinctAudios = asNumber(raw['distinctAudios']);
  const distinctArtists = asNumber(raw['distinctArtists']);
  if (plays == null || listenedSeconds == null || distinctAudios == null || distinctArtists == null) {
    return null;
  }
  const summary: StatsSummary = {
    plays: Math.max(0, plays),
    listenedSeconds: Math.max(0, listenedSeconds),
    distinctAudios: Math.max(0, Math.round(distinctAudios)),
    distinctArtists: Math.max(0, Math.round(distinctArtists)),
  };
  const from = dateOrUndefined(raw['from']);
  const to = dateOrUndefined(raw['to']);
  if (from) {
    summary.from = from;
  }
  if (to) {
    summary.to = to;
  }
  return summary;
}

export function normalizeStatsRanks(raw: unknown): StatsRank[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const ranks: StatsRank[] = [];
  for (const item of raw) {
    const rank = normalizeStatsRank(item);
    if (rank) {
      ranks.push(rank);
    }
  }
  return ranks;
}

export function normalizeStatsRank(raw: unknown): StatsRank | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asNumber(raw['id']);
  const name = raw['name'];
  if (id == null || !Number.isInteger(id) || typeof name !== 'string') {
    return null;
  }
  const rank: StatsRank = {
    id,
    name,
    plays: Math.max(0, asNumber(raw['plays']) ?? 0),
    listenedSeconds: Math.max(0, asNumber(raw['listenedSeconds']) ?? 0),
  };
  const secondary = raw['secondaryName'];
  if (typeof secondary === 'string' && secondary !== '') {
    rank.secondaryName = secondary;
  }
  return rank;
}

export function normalizeStatsTimeline(raw: unknown): StatsBucket[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const buckets: StatsBucket[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }
    const period = item['period'];
    if (typeof period !== 'string' || !period) {
      continue;
    }
    buckets.push({
      period,
      plays: Math.max(0, asNumber(item['plays']) ?? 0),
      listenedSeconds: Math.max(0, asNumber(item['listenedSeconds']) ?? 0),
    });
  }
  return buckets;
}

function dateOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}
