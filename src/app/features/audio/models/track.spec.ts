import { normalizeTrack, normalizeTrackList, trackSubtitle, trackTitle } from './track';

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
        artist: 'Artista',
        album: 'Álbum',
        durationSeconds: 84,
        trackNumber: 2,
      },
    ]);

    expect(track).toMatchObject({
      id: 7,
      name: 'archivo',
      title: 'Canción',
      artist: 'Artista',
      album: 'Álbum',
      durationSeconds: 84,
      trackNumber: 2,
    });
    expect(trackTitle(track)).toBe('Canción');
    expect(trackSubtitle(track)).toBe('Artista · Álbum');
  });

  it('falls back to name when title is missing and ignores rows without an id', () => {
    expect(normalizeTrack({ name: 'Solo' })).toBeNull();
    const track = normalizeTrack({ id: 1, name: 'Solo', extension: 'mp3' });
    expect(trackTitle(track)).toBe('Solo');
    expect(track?.artist).toBeNull();
    expect(trackSubtitle(track)).toBe('');
  });
});
