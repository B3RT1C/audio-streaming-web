export type StatsPreset = 'today' | '7d' | 'month' | 'year' | 'all' | 'custom';

export type StatsGranularity = 'day' | 'month' | 'year';

/** Inclusive `YYYY-MM-DD` bounds. Both omitted means the whole history. */
export interface StatsRange {
  from?: string;
  to?: string;
}

export const STATS_TIME_ZONE = 'Europe/Madrid';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function madridDate(now: Date, timeZone = STATS_TIME_ZONE): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
}

export function formatIsoDate(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/** Adds calendar days to a `YYYY-MM-DD` date. The arithmetic does not depend on the local zone. */
export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return formatIsoDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
}

export function inclusiveIsoDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function rangeForPreset(preset: StatsPreset, now: Date, timeZone = STATS_TIME_ZONE): StatsRange {
  if (preset === 'all' || preset === 'custom') {
    return {};
  }
  const today = formatIsoDate(madridDate(now, timeZone));
  if (preset === 'today') {
    return { from: today, to: today };
  }
  if (preset === '7d') {
    return { from: addIsoDays(today, -6), to: today };
  }
  const parts = madridDate(now, timeZone);
  if (preset === 'month') {
    return { from: formatIsoDate({ ...parts, day: 1 }), to: today };
  }
  return { from: formatIsoDate({ year: parts.year, month: 1, day: 1 }), to: today };
}

export function normalizeCustomRange(from: string, to: string): StatsRange | null {
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return null;
  }
  return from <= to ? { from, to } : { from: to, to: from };
}

export function defaultGranularity(preset: StatsPreset, range: StatsRange): StatsGranularity {
  if (preset === 'year') {
    return 'month';
  }
  if (preset === 'all') {
    return 'year';
  }
  if (preset === 'custom' && range.from && range.to) {
    const days = inclusiveIsoDays(range.from, range.to);
    if (days > 800) {
      return 'year';
    }
    if (days > 62) {
      return 'month';
    }
  }
  return 'day';
}

export function formatPeriodLabel(period: string): string {
  const parts = period.split('-');
  if (parts.length >= 2 && parts.length <= 3 && parts.every((part) => /^\d+$/.test(part))) {
    const month = MONTHS[Number(parts[1]) - 1];
    if (month && parts.length === 3) {
      return `${Number(parts[2])} ${month}`;
    }
    if (month && parts.length === 2) {
      return `${month} ${parts[0]}`;
    }
  }
  return period;
}

export function formatRangeLabel(preset: StatsPreset, range: StatsRange): string {
  if (preset === 'all' || (!range.from && !range.to)) {
    return 'Todo el histórico';
  }
  if (range.from && range.to && range.from === range.to) {
    return formatPeriodLabel(range.from);
  }
  if (range.from && range.to) {
    return `${formatPeriodLabel(range.from)} – ${formatPeriodLabel(range.to)}`;
  }
  return 'Periodo';
}

/** Hours and minutes. A listen under a minute stays visible. */
export function formatListened(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 min';
  }
  const total = Math.round(seconds);
  if (total < 60) {
    return '< 1 min';
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`;
  }
  if (hours > 0) {
    return `${hours} h`;
  }
  return `${minutes} min`;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
