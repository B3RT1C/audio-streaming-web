import {
  defaultGranularity,
  formatListened,
  madridDate,
  normalizeCustomRange,
  rangeForPreset,
} from './stats-range';

describe('stats range', () => {
  it('uses the Madrid calendar day, including just after midnight there', () => {
    const lateUtc = new Date('2026-11-16T23:30:00.000Z');
    expect(madridDate(lateUtc)).toEqual({ year: 2026, month: 11, day: 17 });
    expect(rangeForPreset('today', lateUtc)).toEqual({ from: '2026-11-17', to: '2026-11-17' });
  });

  it('builds inclusive presets and leaves the whole history unbounded', () => {
    const now = new Date('2026-11-17T12:00:00.000Z');
    expect(rangeForPreset('7d', now)).toEqual({ from: '2026-11-11', to: '2026-11-17' });
    expect(rangeForPreset('month', now)).toEqual({ from: '2026-11-01', to: '2026-11-17' });
    expect(rangeForPreset('year', now)).toEqual({ from: '2026-01-01', to: '2026-11-17' });
    expect(rangeForPreset('all', now)).toEqual({});
  });

  it('orders a custom range and picks a granularity that fits it', () => {
    expect(normalizeCustomRange('2026-03-02', '2026-01-05')).toEqual({ from: '2026-01-05', to: '2026-03-02' });
    expect(normalizeCustomRange('2026-02-31', '2026-03-01')).toBeNull();
    expect(defaultGranularity('7d', { from: '2026-11-11', to: '2026-11-17' })).toBe('day');
    expect(defaultGranularity('year', {})).toBe('month');
    expect(defaultGranularity('all', {})).toBe('year');
    expect(defaultGranularity('custom', { from: '2024-01-01', to: '2026-11-17' })).toBe('year');
    expect(formatListened(0)).toBe('0 min');
    expect(formatListened(40)).toBe('< 1 min');
    expect(formatListened(125)).toBe('2 min');
    expect(formatListened(5400)).toBe('1 h 30 min');
  });
});
