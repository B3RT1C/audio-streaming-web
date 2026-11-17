import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { CatalogService } from './catalog-service';

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;
  let config: RuntimeConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
    config = TestBed.inject(RuntimeConfigService);
  });

  afterEach(() => http.verify());

  it('lists artists and tags and replaces artist tags', () => {
    let artistCount = 0;
    service.listArtists().subscribe((artists) => {
      artistCount = artists[0]?.audioCount ?? 0;
    });
    http.expectOne(config.url('/artists')).flush([{ id: 4, name: 'José', audioCount: 9, tags: ['Live'] }]);
    expect(artistCount).toBe(9);

    let playlistCount = 0;
    service.listTags().subscribe((tags) => {
      playlistCount = tags[0]?.playlistCount ?? -1;
    });
    http
      .expectOne(config.url('/tags'))
      .flush([{ id: 1, name: 'Live', audioCount: 4, artistCount: 1, playlistCount: 0 }]);
    expect(playlistCount).toBe(0);

    service.replaceArtistTags(4, []).subscribe();
    const replaced = http.expectOne(config.url('/artists/4/tags'));
    expect(replaced.request.method).toBe('PUT');
    expect(replaced.request.body).toEqual({ tags: [] });
    replaced.flush({ id: 4, name: 'José', audioCount: 9, tags: [] });
  });

  it('filters artists by name and every tag', () => {
    service.listArtists('  ', []).subscribe();
    const plain = http.expectOne(config.url('/artists'));
    expect(plain.request.params.keys().length).toBe(0);
    plain.flush([]);

    service.listArtists('Sol', ['Jazz', 'Pop']).subscribe();
    const filtered = http.expectOne((request) => request.url === config.url('/artists'));
    expect(filtered.request.params.get('q')).toBe('Sol');
    expect(filtered.request.params.getAll('tag')).toEqual(['Jazz', 'Pop']);
    filtered.flush([]);
  });
});
