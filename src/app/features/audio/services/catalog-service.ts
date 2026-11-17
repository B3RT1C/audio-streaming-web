import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { Artist, normalizeArtist, normalizeArtistList, normalizeTagList, TagSummary } from '../models/catalog';
import { API_PATHS } from '../models/track';

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private http = inject(HttpClient);
  private config = inject(RuntimeConfigService);

  listArtists(): Observable<Artist[]> {
    return this.http
      .get<unknown>(this.config.url(API_PATHS.artists))
      .pipe(map((body) => normalizeArtistList(body)));
  }

  listTags(): Observable<TagSummary[]> {
    return this.http
      .get<unknown>(this.config.url(API_PATHS.tags))
      .pipe(map((body) => normalizeTagList(body)));
  }

  /** Replaces the artist's tags. Does not rename the artist or its tracks. */
  replaceArtistTags(id: number, tags: string[]): Observable<Artist | null> {
    return this.http
      .put<unknown>(`${this.config.url(API_PATHS.artists)}/${id}/tags`, { tags })
      .pipe(map((body) => normalizeArtist(body)));
  }
}
