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

    history.replaceState(history.state, '', '/');
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
        secondaryTitle: 'Night',
        artist: 'Luna',
        album: 'Azul',
        durationSeconds: 95,
        trackNumber: 3,
        tags: ['Directo'],
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
    expect(text).toContain('Night');
    expect(text).toContain('Luna');
    expect(text).toContain('Azul');
    expect(text).toContain('Directo');
    expect(text).toContain('1:35');
    fixture.componentInstance.showSection('search');
    fixture.detectChanges();
    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(search.placeholder).toBe('Buscar o filtrar: género:, año:, #etiqueta');
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
            secondaryTitle: 'Night',
            artist: 'Luna',
            album: 'Azul',
            durationSeconds: 95,
            trackNumber: 3,
            tags: ['Directo'],
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
    expect(text).toContain('Night');
    expect(text).toContain('Directo');
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

  it('saves a secondary title without rewriting the main title, then replaces tags', () => {
    const track = fixture.componentInstance.catalog()[0];
    fixture.componentInstance.editing.set(track);
    fixture.componentInstance.saveMetadata({
      patch: { secondaryTitle: null, artist: 'Luna', album: 'Azul', trackNumber: 3 },
      tags: ['Live'],
    });

    const patch = http.expectOne((request) => request.method === 'PATCH' && request.url.endsWith('/audios/4'));
    expect(patch.request.body).toEqual({
      secondaryTitle: null,
      artist: 'Luna',
      album: 'Azul',
      trackNumber: 3,
    });
    expect(patch.request.body.title).toBeUndefined();
    patch.flush({
      id: 4,
      name: 'song.mp3',
      title: 'Noche',
      secondaryTitle: null,
      artist: 'Luna',
      album: 'Azul',
      extension: 'mp3',
      tags: ['Directo'],
    });

    const tags = http.expectOne((request) => request.method === 'PUT' && request.url.endsWith('/audios/4/tags'));
    expect(tags.request.body).toEqual({ tags: ['Live'] });
    tags.flush({
      id: 4,
      name: 'song.mp3',
      title: 'Noche',
      secondaryTitle: null,
      extension: 'mp3',
      tags: ['Live'],
    });
    http
      .expectOne(
        (request) =>
          request.method === 'GET' &&
          request.url.endsWith('/audios') &&
          !request.params.has('q') &&
          !request.params.has('tag'),
      )
      .flush([]);
  });

  it('filters by a tag and combines that filter with the current search', async () => {
    fixture.componentInstance.showSection('tags');
    http.expectOne((request) => request.method === 'GET' && request.url.endsWith('/tags')).flush([
      { id: 1, name: 'Live', type: 'free', readOnly: false, audioCount: 4, artistCount: 1, playlistCount: 2 },
    ]);
    http.expectOne((request) => request.method === 'GET' && request.url.endsWith('/tag-types')).flush([
      { id: 6, key: 'free', name: 'Libre', system: true },
    ]);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Live');
    expect(text).toContain('4');

    fixture.componentInstance.query.set('noche');
    const row = [...fixture.nativeElement.querySelectorAll('button.tag-chip')].find((node) =>
      (node.textContent ?? '').includes('Live'),
    ) as HTMLButtonElement;
    row.click();
    http
      .expectOne((request) => request.params.get('f') === '#Live' && request.params.get('q') === 'noche')
      .flush([
        {
          id: 4,
          name: 'song.mp3',
          path: 'p',
          extension: 'mp3',
          title: 'Noche',
          secondaryTitle: 'Night',
          artist: 'Luna',
          album: 'Azul',
          durationSeconds: 95,
          trackNumber: 3,
          tags: ['Live'],
        },
      ]);
    fixture.detectChanges();
    expect(fixture.componentInstance.section()).toBe('search');
    expect(fixture.nativeElement.textContent).toContain('Night');
    expect(fixture.nativeElement.textContent).toContain('Se combina con la búsqueda');

    fixture.componentInstance.onSearchInput({ target: { value: 'luna' } } as unknown as Event);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const searched = http.expectOne(
      (request) => request.params.get('q') === 'luna' && request.params.get('f') === '#Live',
    );
    searched.flush([]);
  });

  it('lists artists with their counts and opens tag editing', () => {
    fixture.componentInstance.showSection('artists');
    http.expectOne((request) => request.method === 'GET' && request.url.endsWith('/artists')).flush([
      { id: 4, name: 'Luna', audioCount: 9, tags: ['Live'] },
    ]);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Luna');
    expect(text).toContain('9 canciones');
    expect(text).toContain('Live');

    const edit = fixture.nativeElement.querySelector(
      'button[aria-label="Editar etiquetas de Luna"]',
    ) as HTMLButtonElement;
    edit.click();
    http.expectOne((request) => request.method === 'GET' && request.url.endsWith('/tags')).flush([
      { id: 1, name: 'Live', audioCount: 4, artistCount: 1, playlistCount: 0 },
    ]);
    http.expectOne((request) => request.method === 'GET' && request.url.endsWith('/tag-types')).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Etiquetas de Luna');

    fixture.componentInstance.saveTags(['Pop']);
    const saved = http.expectOne((request) => request.method === 'PUT' && request.url.endsWith('/artists/4/tags'));
    expect(saved.request.body).toEqual({ tags: ['Pop'] });
    saved.flush({ id: 4, name: 'Luna', audioCount: 9, tags: ['Pop'] });
    http.expectOne((request) => request.method === 'GET' && request.url.endsWith('/tags')).flush([
      { id: 2, name: 'Pop', audioCount: 0, artistCount: 1, playlistCount: 0 },
    ]);
    http.expectOne((request) => request.method === 'GET' && request.url.endsWith('/tag-types')).flush([]);
    fixture.detectChanges();
    expect(fixture.componentInstance.artists()[0]?.tags).toEqual(['Pop']);
  });

  it('writes the active library filters into the url and asks for all of them', () => {
    fixture.componentInstance.onLibraryFilters({
      q: 'luna',
      title: 'Noche',
      artist: 'Luna',
      tags: ['Live', 'Pop'],
      artistTags: ['Jazz'],
      playlistTags: ['Viaje'],
    });
    const listed = http.expectOne(
      (request) => request.method === 'GET' && request.url.endsWith('/audios') && request.params.has('title'),
    );
    expect(listed.request.params.get('q')).toBe('luna');
    expect(listed.request.params.get('title')).toBe('Noche');
    expect(listed.request.params.get('artist')).toBe('Luna');
    expect(listed.request.params.getAll('tag')).toEqual(['Live', 'Pop']);
    expect(listed.request.params.getAll('artistTag')).toEqual(['Jazz']);
    expect(listed.request.params.getAll('playlistTag')).toEqual(['Viaje']);
    listed.flush([]);
    expect(location.search).toContain('title=Noche');
    expect(location.search).toContain('tag=Live');
    expect(location.search).toContain('tag=Pop');
    expect(location.search).toContain('artistTag=Jazz');
    expect(location.search).toContain('playlistTag=Viaje');

    fixture.componentInstance.clearLibraryFilters();
    expect(location.search).toBe('');
    expect(fixture.componentInstance.filtersActive()).toBe(false);
  });
});
