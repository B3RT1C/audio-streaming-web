import { normalizeArtistList, normalizeSuggestions, normalizeTagList } from './catalog';

describe('catalog normalization', () => {
  it('reads artists with an exact name, a count and tags', () => {
    const artists = normalizeArtistList([
      { id: 4, name: ' José ', audioCount: 9, tags: ['Live', ''] },
      { id: 'x', name: 'Ana' },
      { name: 'Sin id' },
    ]);

    expect(artists).toEqual([
      {
        id: 4,
        name: ' José ',
        audioCount: 9,
        tags: ['Live'],
        tagItems: [{ name: 'Live', type: 'free', readOnly: false }],
      },
    ]);
  });

  it('reads tag counts independently', () => {
    expect(
      normalizeTagList([
        { id: 1, name: 'Live', audioCount: 4, artistCount: 1, playlistCount: 0 },
        { id: 2, name: '   ' },
      ]),
    ).toEqual([
      {
        id: 1,
        name: 'Live',
        type: 'free',
        readOnly: false,
        audioCount: 4,
        artistCount: 1,
        playlistCount: 0,
      },
    ]);
  });

  it('reads tag type as a string or as the object returned by GET /tags', () => {
    expect(
      normalizeTagList([
        {
          id: 5,
          name: 'Rock',
          audioCount: 2,
          artistCount: 0,
          playlistCount: 0,
          readOnly: true,
          type: { id: 2, key: 'genre', name: 'Género', system: true },
        },
        { id: 6, name: 'Directo', type: 'free', audioCount: 1, artistCount: 0, playlistCount: 0 },
      ]),
    ).toEqual([
      {
        id: 5,
        name: 'Rock',
        type: 'genre',
        readOnly: true,
        audioCount: 2,
        artistCount: 0,
        playlistCount: 0,
      },
      {
        id: 6,
        name: 'Directo',
        type: 'free',
        readOnly: false,
        audioCount: 1,
        artistCount: 0,
        playlistCount: 0,
      },
    ]);
  });

  it('reads suggestion types when the API sends the type object', () => {
    expect(
      normalizeSuggestions([
        { type: { id: 2, key: 'genre', name: 'Género', system: true }, value: 'Rock', count: 2 },
      ]),
    ).toEqual([{ type: 'genre', value: 'Rock', count: 2 }]);
  });
});
