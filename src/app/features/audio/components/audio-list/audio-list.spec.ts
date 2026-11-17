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
    secondaryTitle: 'Song',
    artist: 'Artista',
    album: 'Álbum',
    durationSeconds: 125,
    trackNumber: 2,
    tags: ['Live'],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioList],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioList);
    fixture.componentRef.setInput('entries', [{ audioId: track.id, track }]);
    fixture.detectChanges();
  });

  it('shows title, secondary title, artist, album, duration and tags', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Canción');
    expect(text).toContain('Song');
    expect(text).toContain('Artista');
    expect(text).toContain('Álbum');
    expect(text).toContain('2:05');
    expect(text).toContain('Live');
    const chip = fixture.nativeElement.querySelector('button[aria-label="Filtrar por Live"]') as HTMLButtonElement;
    const picked: string[] = [];
    fixture.componentInstance.tagSelected.subscribe((tag) => picked.push(tag));
    chip.click();
    expect(picked).toEqual(['Live']);
  });

  it('renders only a window of a multi-thousand library', () => {
    const entries = Array.from({ length: 7000 }, (_, index) => ({
      audioId: index + 1,
      track: { ...track, id: index + 1, title: `Tema ${index + 1}`, secondaryTitle: null, tags: [] as string[] },
    }));
    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('.tracks li');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(80);
    expect(fixture.nativeElement.textContent).toContain('Tema 1');
    expect(fixture.nativeElement.textContent).not.toContain('Tema 7000');
  });

  it('asks before deleting a track from the library', () => {
    const more = fixture.nativeElement.querySelector('button[aria-label="Más opciones"]') as HTMLButtonElement;
    more.click();
    fixture.detectChanges();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((node) =>
      (node as HTMLButtonElement).textContent?.includes('Borrar'),
    ) as HTMLButtonElement;
    button.click();
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
