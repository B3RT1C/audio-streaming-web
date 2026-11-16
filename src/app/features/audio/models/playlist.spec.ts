import { normalizePlaylist, normalizePlaylistList } from './playlist';

describe('normalizePlaylist', () => {
  it('reads a list of playlists and item audio ids', () => {
    const playlists = normalizePlaylistList([
      { id: 3, name: 'Noche', items: [{ audioId: 9, position: 1 }, { audioId: 4, position: 0 }] },
    ]);

    expect(playlists).toEqual([
      {
        id: 3,
        name: 'Noche',
        items: [
          { audioId: 4, position: 0 },
          { audioId: 9, position: 1 },
        ],
      },
    ]);
  });

  it('accepts a bare id list and a wrapped collection', () => {
    expect(normalizePlaylist({ id: 1, name: 'Cola', items: [8, 2] })?.items.map((item) => item.audioId)).toEqual([
      8, 2,
    ]);
    expect(normalizePlaylistList({ content: [{ id: 5, name: 'Gym' }] })).toEqual([
      { id: 5, name: 'Gym', items: [] },
    ]);
  });

  it('reads audioId from a nested audio object', () => {
    const playlist = normalizePlaylist({ id: 2, name: 'Mix', items: [{ audio: { id: 11 } }] });
    expect(playlist?.items[0].audioId).toBe(11);
  });
});
