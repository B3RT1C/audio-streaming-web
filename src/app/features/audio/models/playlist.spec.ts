import { normalizePlaylist, normalizePlaylistItem, normalizePlaylistList } from './playlist';

const track = (id: number, title: string) => ({
  id,
  name: `${title}.mp3`,
  path: 'uploads/songs',
  extension: 'mp3',
  title,
  artist: 'Sol',
  album: 'Noche',
  durationSeconds: 40,
  trackNumber: id,
});

describe('normalizePlaylist', () => {
  it('reads a summary without items and keeps itemCount', () => {
    const playlists = normalizePlaylistList([
      {
        id: 3,
        name: 'Noche',
        createdAt: '2026-11-16T00:00:00Z',
        updatedAt: '2026-11-16T00:00:00Z',
        itemCount: 4,
      },
    ]);

    expect(playlists).toEqual([{ id: 3, name: 'Noche', itemCount: 4, items: null, tags: [] }]);
  });

  it('sorts detail items by position even when there are gaps, and keeps the nested audio', () => {
    const playlist = normalizePlaylist({
      id: 3,
      name: 'Noche',
      itemCount: 2,
      items: [
        { position: 5, audioId: 9, audio: track(9, 'Cierre') },
        { position: 1, audioId: 4, audio: track(4, 'Apertura') },
      ],
    });

    expect(playlist?.items?.map((item) => item.audioId)).toEqual([4, 9]);
    expect(playlist?.items?.map((item) => item.position)).toEqual([1, 5]);
    expect(playlist?.items?.[0].audio?.title).toBe('Apertura');
    expect(playlist?.itemCount).toBe(2);
  });

  it('reads audioId from the nested audio when the shortcut field is missing', () => {
    const item = normalizePlaylistItem({ position: 2, audio: track(11, 'Mix') });
    expect(item).toEqual({
      position: 2,
      audioId: 11,
      audio: expect.objectContaining({ id: 11, title: 'Mix' }),
    });
  });

  it('treats an empty items array as a loaded empty playlist', () => {
    expect(normalizePlaylist({ id: 1, name: 'Cola', itemCount: 0, items: [] })).toEqual({
      id: 1,
      name: 'Cola',
      itemCount: 0,
      items: [],
      tags: [],
    });
  });

  it('keeps playlist tags and the secondary title nested in each item', () => {
    const playlist = normalizePlaylist({
      id: 8,
      name: 'Viaje',
      itemCount: 1,
      tags: [' Live ', ''],
      items: [
        {
          position: 1,
          audioId: 4,
          audio: { ...track(4, 'Apertura'), secondaryTitle: 'Opening', tags: ['Live'] },
        },
      ],
    });

    expect(playlist?.tags).toEqual(['Live']);
    expect(playlist?.items?.[0].audio?.secondaryTitle).toBe('Opening');
    expect(playlist?.items?.[0].audio?.tags).toEqual(['Live']);
  });
});
