import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { AudioService, UploadProgressEvent } from './audio-service';

describe('AudioService', () => {
  let service: AudioService;
  let http: HttpTestingController;
  let config: RuntimeConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AudioService);
    http = TestBed.inject(HttpTestingController);
    config = TestBed.inject(RuntimeConfigService);
  });

  afterEach(() => http.verify());

  it('searches with the q parameter and normalizes metadata', () => {
    let titles: string[] = [];
    service.list('luna').subscribe((tracks) => {
      titles = tracks.map((track) => track.title ?? '');
    });

    const req = http.expectOne(
      (request) => request.url === config.url('/audios') && request.params.get('q') === 'luna',
    );
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 1,
        name: 'a.mp3',
        path: 'p',
        extension: 'mp3',
        title: 'Luna',
        secondaryTitle: 'Moon',
        artist: 'Sol',
        album: 'Noche',
        durationSeconds: 40,
        trackNumber: 1,
        tags: ['Live'],
      },
    ]);
    expect(titles).toEqual(['Luna']);
  });

  it('combines the tag filter with the search and replaces tags', () => {
    let secondary = '';
    service.list('luna', 'Live').subscribe((tracks) => {
      secondary = tracks[0]?.secondaryTitle ?? '';
    });
    const listed = http.expectOne(
      (request) =>
        request.url === config.url('/audios') &&
        request.params.get('q') === 'luna' &&
        request.params.get('tag') === 'Live',
    );
    listed.flush([
      {
        id: 1,
        name: 'a.mp3',
        title: 'Luna',
        secondaryTitle: 'Moon',
        extension: 'mp3',
        tags: ['Live'],
      },
    ]);
    expect(secondary).toBe('Moon');

    service.replaceTags(1, []).subscribe();
    const replaced = http.expectOne(config.url('/audios/1/tags'));
    expect(replaced.request.method).toBe('PUT');
    expect(replaced.request.body).toEqual({ tags: [] });
    replaced.flush({ id: 1, name: 'a.mp3', title: 'Luna', secondaryTitle: 'Moon', extension: 'mp3', tags: [] });
  });

  it('patches title, artist, album and track number', () => {
    const patch = { title: 'Luna', artist: 'Sol', album: 'Noche', trackNumber: null };
    service.updateMetadata(4, patch).subscribe();

    const req = http.expectOne(config.url('/audios/4'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(patch);
    req.flush({ id: 4, name: 'a.mp3', ...patch, extension: 'mp3' });
  });

  it('uploads with progress and the catalog name', () => {
    const events: UploadProgressEvent[] = [];
    const file = new File(['abcd'], 'tema.mp3', { type: 'audio/mpeg' });
    service.upload(file, 'Tema').subscribe((event) => events.push(event));

    const req = http.expectOne(config.url('/audios'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).get('name')).toBe('Tema');
    req.event({ type: HttpEventType.UploadProgress, loaded: 2, total: 4 });
    req.event(new HttpResponse({ status: 201, body: { message: 'ok' } }));

    expect(events[0]).toMatchObject({ percent: 50, done: false });
    expect(events.some((event) => event.done)).toBe(true);
  });

  it('deletes a track', () => {
    service.delete(9).subscribe();
    const req = http.expectOne(config.url('/audios/9'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
