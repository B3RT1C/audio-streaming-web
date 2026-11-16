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
    service.list().subscribe();
    http.expectOne(config.url('/playlists')).flush([{ id: 1, name: 'Noche', items: [] }]);

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
    service.addItem(3, 11).subscribe();
    const added = http.expectOne(config.url('/playlists/3/items'));
    expect(added.request.method).toBe('POST');
    expect(added.request.body).toEqual({ audioId: 11 });
    added.flush({ id: 3, name: 'Noche', items: [{ audioId: 11 }] });

    service.reorder(3, [11, 4, 8]).subscribe();
    const order = http.expectOne(config.url('/playlists/3/items'));
    expect(order.request.method).toBe('PUT');
    expect(order.request.body).toEqual([11, 4, 8]);
    order.flush(null);

    service.removeItem(3, 4).subscribe();
    const removed = http.expectOne(config.url('/playlists/3/items/4'));
    expect(removed.request.method).toBe('DELETE');
    removed.flush(null);
  });
});
