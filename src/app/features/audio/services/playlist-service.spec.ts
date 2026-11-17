import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { PlaylistService } from './playlist-service';

describe('PlaylistService', () => {
  let service: PlaylistService;
  let http: HttpTestingController;
  let config: RuntimeConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PlaylistService);
    http = TestBed.inject(HttpTestingController);
    config = TestBed.inject(RuntimeConfigService);
  });

  afterEach(() => http.verify());

  it('lists, creates, renames and deletes playlists', () => {
    let summaries: { itemCount: number; items: unknown }[] = [];
    service.list().subscribe((playlists) => {
      summaries = playlists;
    });
    http.expectOne(config.url('/playlists')).flush([
      {
        id: 1,
        name: 'Noche',
        itemCount: 3,
        tags: ['Noche'],
        createdAt: '2026-11-16T00:00:00Z',
        updatedAt: '2026-11-16T00:00:00Z',
      },
    ]);
    expect(summaries).toEqual([{ id: 1, name: 'Noche', itemCount: 3, items: null, tags: ['Noche'] }]);

    service.create('Gym').subscribe();
    const created = http.expectOne(config.url('/playlists'));
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual({ name: 'Gym' });
    created.flush({ id: 2, name: 'Gym', items: [] });

    service.rename(2, 'Casa').subscribe();
    const renamed = http.expectOne(config.url('/playlists/2'));
    expect(renamed.request.method).toBe('PATCH');
    expect(renamed.request.body).toEqual({ name: 'Casa' });
    renamed.flush({ id: 2, name: 'Casa' });

    service.delete(2).subscribe();
    const removed = http.expectOne(config.url('/playlists/2'));
    expect(removed.request.method).toBe('DELETE');
    removed.flush(null);
  });

  it('adds, removes and reorders items', () => {
    let addedId = 0;
    service.addItem(3, 11).subscribe((item) => {
      addedId = item?.audioId ?? 0;
    });
    const added = http.expectOne(config.url('/playlists/3/items'));
    expect(added.request.method).toBe('POST');
    expect(added.request.body).toEqual({ audioId: 11 });
    added.flush({
      position: 2,
      audioId: 11,
      audio: { id: 11, name: 'a.mp3', title: 'Tema', extension: 'mp3', path: 'p' },
    });
    expect(addedId).toBe(11);

    service.reorder(3, [11, 4, 8]).subscribe();
    const order = http.expectOne(config.url('/playlists/3/items'));
    expect(order.request.method).toBe('PUT');
    expect(order.request.body).toEqual({ audioIds: [11, 4, 8] });
    order.flush({
      id: 3,
      name: 'Noche',
      itemCount: 3,
      items: [
        { position: 1, audioId: 11, audio: { id: 11, name: 'a.mp3', title: 'Tema', extension: 'mp3' } },
        { position: 2, audioId: 4, audio: { id: 4, name: 'b.mp3', title: 'Otra', extension: 'mp3' } },
        { position: 3, audioId: 8, audio: { id: 8, name: 'c.mp3', title: 'Tres', extension: 'mp3' } },
      ],
    });

    service.removeItem(3, 4).subscribe();
    const removed = http.expectOne(config.url('/playlists/3/items/4'));
    expect(removed.request.method).toBe('DELETE');
    removed.flush(null);
  });

  it('replaces playlist tags', () => {
    let names: string[] = [];
    service.replaceTags(3, ['Live']).subscribe((playlist) => {
      names = playlist?.tags ?? [];
    });
    const req = http.expectOne(config.url('/playlists/3/tags'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ tags: ['Live'] });
    req.flush({ id: 3, name: 'Noche', itemCount: 0, items: [], tags: ['Live'] });
    expect(names).toEqual(['Live']);
  });
});
