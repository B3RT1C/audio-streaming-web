import { normalizeArtistList, normalizeTagList } from './catalog';

describe('catalog normalization', () => {
  it('reads artists with an exact name, a count and tags', () => {
    const artists = normalizeArtistList([
      { id: 4, name: ' José ', audioCount: 9, tags: ['Live', ''] },
      { id: 'x', name: 'Ana' },
      { name: 'Sin id' },
    ]);

    expect(artists).toEqual([{ id: 4, name: ' José ', audioCount: 9, tags: ['Live'] }]);
  });

  it('reads tag counts independently', () => {
    expect(
      normalizeTagList([
        { id: 1, name: 'Live', audioCount: 4, artistCount: 1, playlistCount: 0 },
        { id: 2, name: '   ' },
      ]),
    ).toEqual([{ id: 1, name: 'Live', audioCount: 4, artistCount: 1, playlistCount: 0 }]);
  });
});
