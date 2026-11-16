import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioPlayer } from './audio-player';

describe('AudioPlayer', () => {
  let fixture: ComponentFixture<AudioPlayer>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioPlayer],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioPlayer);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/audios') && !request.params.has('q')).flush([
      {
        id: 4,
        name: 'song.mp3',
        path: 'p',
        extension: 'mp3',
        title: 'Noche',
        artist: 'Luna',
        album: 'Azul',
        durationSeconds: 95,
        trackNumber: 3,
      },
    ]);
    http.expectOne((request) => request.url.endsWith('/playlists')).flush([
      {
        id: 7,
        name: 'Viaje',
        itemCount: 9,
        createdAt: '2026-11-16T00:00:00Z',
        updatedAt: '2026-11-16T00:00:00Z',
      },
    ]);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('shows the library returned by the API', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Noche');
    expect(text).toContain('Luna');
    expect(text).toContain('Azul');
    expect(text).toContain('1:35');
    fixture.componentInstance.showSection('search');
    fixture.detectChanges();
    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(search.placeholder).toContain('título');
    expect(search.placeholder).toContain('artista');
    const chip = fixture.nativeElement.querySelector('.playlist-chip') as HTMLElement;
    expect(chip.textContent).toContain('Viaje');
    expect(chip.textContent).toContain('9');
  });

  it('plays a playlist from its detail, using nested audio and position order with gaps', () => {
    fixture.componentInstance.openPlaylist(7);
    http.expectOne((request) => request.url.endsWith('/playlists/7')).flush({
      id: 7,
      name: 'Viaje',
      itemCount: 2,
      items: [
        {
          position: 4,
          audioId: 4,
          audio: {
            id: 4,
            name: 'song.mp3',
            path: 'p',
            extension: 'mp3',
            title: 'Noche',
            artist: 'Luna',
            album: 'Azul',
            durationSeconds: 95,
            trackNumber: 3,
          },
        },
        {
          position: 1,
          audioId: 9,
          audio: {
            id: 9,
            name: 'otra.mp3',
            path: 'p',
            extension: 'mp3',
            title: 'Amanecer',
            artist: 'Sol',
            album: 'Rojo',
            durationSeconds: 12,
            trackNumber: 1,
          },
        },
      ],
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text.indexOf('Amanecer')).toBeGreaterThan(-1);
    expect(text.indexOf('Amanecer')).toBeLessThan(text.indexOf('Noche'));
    expect(text).toContain('2 canciones');
    const chip = fixture.nativeElement.querySelector('.playlist-chip') as HTMLElement;
    expect(chip.textContent).toContain('2');
    expect(chip.textContent).not.toContain('9');
  });

  it('reloads the library after an upload that answers with a message and no id', async () => {
    const file = new File(['abcd'], 'nueva.mp3', { type: 'audio/mpeg' });
    fixture.componentInstance.confirmUploadDialog([{ file, name: 'Nueva' }]);

    const post = http.expectOne((request) => request.url.endsWith('/audios') && request.method === 'POST');
    expect(post.request.body).toBeInstanceOf(FormData);
    post.flush({ message: 'File received' }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    const reload = http.expectOne(
      (request) => request.url.endsWith('/audios') && request.method === 'GET' && !request.params.has('q'),
    );
    reload.flush([
      {
        id: 4,
        name: 'song.mp3',
        path: 'p',
        extension: 'mp3',
        title: 'Noche',
        artist: 'Luna',
        album: 'Azul',
        durationSeconds: 95,
        trackNumber: 3,
      },
      {
        id: 12,
        name: 'Nueva',
        path: 'p',
        extension: 'mp3',
        title: 'Nueva',
        artist: null,
        album: null,
        durationSeconds: 3,
        trackNumber: null,
      },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nueva');
  });
});
