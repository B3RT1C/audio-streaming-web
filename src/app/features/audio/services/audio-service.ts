import { HttpClient, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { API_PATHS, normalizeTrack, normalizeTrackList, Track, TrackMetadataPatch } from '../models/track';
import { TagWrite } from '../utils/tag-assignment';
import {
  audioSearchParams,
  emptyLibraryFilters,
  LibraryFilters,
  ShuffleRequest,
  uniqueTags,
} from '../utils/library-filters';

export interface AudioResponse {
  message: string;
}

export interface UploadProgressEvent {
  percent: number | null;
  loaded: number;
  total: number | null;
  done: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private http = inject(HttpClient);
  private config = inject(RuntimeConfigService);

  /**
   * Every filter combines with AND. A string `query` is the 0.3 `q` search,
   * and `tag` is one song tag. Pass a {@link LibraryFilters} for the 0.4 fields.
   * Blank values are omitted so an empty filter stays a plain GET /audios.
   */
  list(query: string | LibraryFilters = '', tag = ''): Observable<Track[]> {
    const filters = typeof query === 'string' ? legacyFilters(query, tag) : normalizeFilters(query);
    return this.fetch(filters);
  }

  /** Same filters as `list`, plus shuffle=true and an optional integer seed. */
  listShuffled(filters: LibraryFilters, seed?: number): Observable<Track[]> {
    return this.fetch(normalizeFilters(filters), Number.isInteger(seed) ? { seed } : {});
  }

  private fetch(filters: LibraryFilters, shuffle?: ShuffleRequest): Observable<Track[]> {
    return this.http
      .get<unknown>(this.audiosUrl(), { params: toHttpParams(audioSearchParams(filters, shuffle)) })
      .pipe(map((body) => normalizeTrackList(body)));
  }

  updateMetadata(id: number, patch: TrackMetadataPatch): Observable<Track | null> {
    return this.http
      .patch<unknown>(`${this.audiosUrl()}/${id}`, patch)
      .pipe(map((body) => normalizeTrack(body)));
  }

  /**
   * Replaces the editable tags. A string is a free tag; `{ type, name }` assigns a type.
   * Derived tags are omitted by the caller and stay on the server.
   */
  replaceTags(id: number, tags: readonly TagWrite[]): Observable<Track | null> {
    return this.http
      .put<unknown>(`${this.audiosUrl()}/${id}/tags`, { tags: [...tags] })
      .pipe(map((body) => normalizeTrack(body)));
  }

  /**
   * POST /audios answers 201 { message } and does not include the new id.
   * After `done`, reload the catalog with `list()`.
   */
  upload(file: File, name?: string): Observable<UploadProgressEvent> {
    const formData = new FormData();
    formData.append('file', file);
    if (name?.trim()) {
      formData.append('name', name.trim());
    }
    return this.http
      .post<AudioResponse>(this.audiosUrl(), formData, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        map((event) => toUploadProgress(event)),
        filter((event): event is UploadProgressEvent => event != null),
      );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.audiosUrl()}/${id}`);
  }

  private audiosUrl(): string {
    return this.config.url(API_PATHS.audios);
  }
}

function legacyFilters(query: string, tag: string): LibraryFilters {
  return { ...emptyLibraryFilters(), q: query, tags: tag.trim() ? [tag] : [] };
}

function normalizeFilters(filters: LibraryFilters): LibraryFilters {
  return {
    q: filters.q,
    title: filters.title,
    artist: filters.artist,
    tags: uniqueTags(filters.tags),
    artistTags: uniqueTags(filters.artistTags),
    playlistTags: uniqueTags(filters.playlistTags),
    tokens: filters.tokens ?? [],
  };
}

function toHttpParams(search: URLSearchParams): HttpParams {
  let params = new HttpParams();
  search.forEach((value, key) => {
    params = params.append(key, value);
  });
  return params;
}

function toUploadProgress(event: HttpEvent<AudioResponse>): UploadProgressEvent | null {
  if (event.type === HttpEventType.UploadProgress) {
    const total = event.total ?? null;
    const percent = total && total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : null;
    return { percent, loaded: event.loaded, total, done: false };
  }
  if (event.type === HttpEventType.Response) {
    return { percent: 100, loaded: 0, total: null, done: true };
  }
  return null;
}
