import { normalizeStatsRank, normalizeStatsRanks, normalizeStatsSummary, normalizeStatsTimeline } from './stats';

describe('stats models', () => {
  it('keeps ranking names exactly as the API sent them', () => {
    const rank = normalizeStatsRank({
      id: 3,
      name: '  Luna  Azul ',
      secondaryName: 'DJ  K',
      plays: 2,
      listenedSeconds: 90,
    });
    expect(rank).toEqual({
      id: 3,
      name: '  Luna  Azul ',
      secondaryName: 'DJ  K',
      plays: 2,
      listenedSeconds: 90,
    });
    expect(normalizeStatsRanks([{ id: 1, name: 'Uno', plays: 1, listenedSeconds: 1 }])).toHaveLength(1);
    expect(normalizeStatsRanks({ nope: true })).toBeNull();
  });

  it('reads the summary and the timeline', () => {
    expect(
      normalizeStatsSummary({
        plays: 4,
        listenedSeconds: 120,
        distinctAudios: 3,
        distinctArtists: 2,
        from: '2026-11-01',
        to: '2026-11-17',
      }),
    ).toEqual({
      plays: 4,
      listenedSeconds: 120,
      distinctAudios: 3,
      distinctArtists: 2,
      from: '2026-11-01',
      to: '2026-11-17',
    });
    expect(normalizeStatsSummary({})).toBeNull();
    expect(normalizeStatsTimeline([{ period: '2026-11', plays: 1, listenedSeconds: 30 }])).toEqual([
      { period: '2026-11', plays: 1, listenedSeconds: 30 },
    ]);
  });
});
