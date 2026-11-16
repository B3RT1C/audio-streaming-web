import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Track } from '../../models/track';
import { AudioList } from './audio-list';

describe('AudioList', () => {
  let fixture: ComponentFixture<AudioList>;

  const track: Track = {
    id: 3,
    name: 'file.mp3',
    path: '',
    extension: 'mp3',
    title: 'Canción',
    artist: 'Artista',
    album: 'Álbum',
    durationSeconds: 125,
    trackNumber: 2,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioList],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioList);
    fixture.componentRef.setInput('entries', [{ audioId: track.id, track }]);
    fixture.detectChanges();
  });

  it('shows title, artist, album and duration', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Canción');
    expect(text).toContain('Artista');
    expect(text).toContain('Álbum');
    expect(text).toContain('2:05');
    expect(text).toContain('2');
  });

  it('asks before deleting a track from the library', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((node) =>
      (node as HTMLButtonElement).textContent?.includes('Borrar'),
    ) as HTMLButtonElement;
    button.click();
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
