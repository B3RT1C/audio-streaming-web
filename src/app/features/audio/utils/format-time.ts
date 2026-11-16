export function formatClock(seconds: number | null | undefined, unknown = '—'): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return unknown;
  }

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = mins.toString().padStart(hours > 0 ? 2 : 1, '0');
  const ss = secs.toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mins}:${ss}`;
}
