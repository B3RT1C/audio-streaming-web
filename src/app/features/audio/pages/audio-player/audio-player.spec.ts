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
    http.expectOne((request) => request.url.endsWith('/playlists')).flush([]);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('shows the library returned by the API', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Noche');
    expect(text).toContain('Luna');
    expect(text).toContain('Azul');
    expect(text).toContain('1:35');
    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(search.placeholder).toContain('título');
    expect(search.placeholder).toContain('artista');
  });
});
