import { normalizeTrack, normalizeTrackList, trackSecondary, trackSubtitle, trackTitle } from './track';

describe('normalizeTrack', () => {
  it('keeps the 0.1 fields and maps the 0.2 metadata', () => {
    const [track] = normalizeTrackList([
      {
        id: 7,
        path: 'uploads/songs/a.mp3',
        name: 'archivo',
        extension: 'mp3',
        contentHash: 'abc',
        title: 'Canción',
        secondaryTitle: '  Song  ',
        artist: 'Artista',
        album: 'Álbum',
        durationSeconds: 84,
        trackNumber: 2,
        tags: ['Live', '  ', 3, 'Rock'],
      },
    ]);

    expect(track).toMatchObject({
      id: 7,
      name: 'archivo',
      title: 'Canción',
      secondaryTitle: 'Song',
      artist: 'Artista',
      album: 'Álbum',
      durationSeconds: 84,
      trackNumber: 2,
      tags: ['Live', 'Rock'],
    });
    expect(trackTitle(track)).toBe('Canción');
    expect(trackSecondary(track)).toBe('Song');
    expect(trackSubtitle(track)).toBe('Artista · Álbum');
  });

  it('treats a blank secondary title as unset and missing tags as an empty list', () => {
    const track = normalizeTrack({ id: 2, name: 'a.mp3', title: 'A', secondaryTitle: '   ' });
    expect(track?.secondaryTitle).toBeNull();
    expect(track?.tags).toEqual([]);
    expect(trackSecondary(track)).toBe('');
  });

  it('falls back to name when title is missing and ignores rows without an id', () => {
    expect(normalizeTrack({ name: 'Solo' })).toBeNull();
    const track = normalizeTrack({ id: 1, name: 'Solo', extension: 'mp3' });
    expect(trackTitle(track)).toBe('Solo');
    expect(track?.artist).toBeNull();
    expect(trackSubtitle(track)).toBe('');
  });
});
