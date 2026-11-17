import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import {
  Artist,
  FilterSuggestion,
  normalizeArtist,
  normalizeArtistList,
  normalizeSuggestions,
  normalizeTagList,
  normalizeTagType,
  normalizeTagTypeList,
  TagSummary,
  TagType,
  TagTypeDraft,
} from '../models/catalog';
import { API_PATHS } from '../models/track';
import { catalogSearchParams, NameTagFilters } from '../utils/library-filters';
import { TagWrite } from '../utils/tag-assignment';

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private http = inject(HttpClient);
  private config = inject(RuntimeConfigService);

  /** `q` and each `tag` combine with AND. Blank values are omitted. */
  listArtists(query = '', tags: string[] = []): Observable<Artist[]> {
    return this.http
      .get<unknown>(this.config.url(API_PATHS.artists), { params: nameTagParams({ q: query, tags }) })
      .pipe(map((body) => normalizeArtistList(body)));
  }

  /** Optional `type` is the type key (`?type=genre`). */
  listTags(type = ''): Observable<TagSummary[]> {
    let params = new HttpParams();
    const key = type.trim();
    if (key) {
      params = params.set('type', key);
    }
    return this.http
      .get<unknown>(this.config.url(API_PATHS.tags), { params })
      .pipe(map((body) => normalizeTagList(body)));
  }

  listTagTypes(): Observable<TagType[]> {
    return this.http
      .get<unknown>(this.config.url(API_PATHS.tagTypes))
      .pipe(map((body) => normalizeTagTypeList(body)));
  }

  createTagType(draft: TagTypeDraft): Observable<TagType | null> {
    return this.http
      .post<unknown>(this.config.url(API_PATHS.tagTypes), typeBody(draft))
      .pipe(map((body) => normalizeTagType(body)));
  }

  updateTagType(id: number, draft: TagTypeDraft): Observable<TagType | null> {
    return this.http
      .patch<unknown>(`${this.config.url(API_PATHS.tagTypes)}/${id}`, typeBody(draft))
      .pipe(map((body) => normalizeTagType(body)));
  }

  deleteTagType(id: number): Observable<void> {
    return this.http.delete<void>(`${this.config.url(API_PATHS.tagTypes)}/${id}`);
  }

  /** Autocomplete for every filter type. `prefix` is the text before `:`, or empty. */
  suggestFilters(prefix: string, q: string): Observable<FilterSuggestion[]> {
    const params = new HttpParams().set('prefix', prefix).set('q', q);
    return this.http
      .get<unknown>(this.config.url(API_PATHS.filterSuggest), { params })
      .pipe(map((body) => normalizeSuggestions(body)));
  }

  /** Replaces the artist's tags. Does not rename the artist or its tracks. */
  replaceArtistTags(id: number, tags: readonly TagWrite[]): Observable<Artist | null> {
    return this.http
      .put<unknown>(`${this.config.url(API_PATHS.artists)}/${id}/tags`, { tags: [...tags] })
      .pipe(map((body) => normalizeArtist(body)));
  }
}

function typeBody(draft: TagTypeDraft): { name: string; key?: string; color?: string } {
  const body: { name: string; key?: string; color?: string } = { name: draft.name.trim() };
  const key = draft.key?.trim();
  if (key) {
    body.key = key;
  }
  const color = draft.color?.trim();
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
    body.color = color;
  }
  return body;
}

function nameTagParams(filters: NameTagFilters): HttpParams {
  let params = new HttpParams();
  catalogSearchParams(filters).forEach((value, key) => {
    params = params.append(key, value);
  });
  return params;
}
