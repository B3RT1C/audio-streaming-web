import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { catalogSearchParams } from '../utils/library-filters';
import {
  normalizePlaylist,
  normalizePlaylistItem,
  normalizePlaylistList,
  Playlist,
  PlaylistItem,
} from '../models/playlist';
import { API_PATHS } from '../models/track';

@Injectable({
  providedIn: 'root',
})
export class PlaylistService {
  private http = inject(HttpClient);
  private config = inject(RuntimeConfigService);

  /** `q` matches the playlist name. Each `tag` is required. Blanks are omitted. */
  list(query = '', tags: string[] = []): Observable<Playlist[]> {
    let params = new HttpParams();
    catalogSearchParams({ q: query, tags }).forEach((value, key) => {
      params = params.append(key, value);
    });
    return this.http
      .get<unknown>(this.collection(), { params })
      .pipe(map((body) => normalizePlaylistList(body)));
  }

  get(id: number): Observable<Playlist | null> {
    return this.http.get<unknown>(this.one(id)).pipe(map((body) => normalizePlaylist(body)));
  }

  create(name: string): Observable<Playlist | null> {
    return this.http
      .post<unknown>(this.collection(), { name })
      .pipe(map((body) => normalizePlaylist(body)));
  }

  rename(id: number, name: string): Observable<Playlist | null> {
    return this.http
      .patch<unknown>(this.one(id), { name })
      .pipe(map((body) => normalizePlaylist(body)));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(this.one(id));
  }

  /** Responds with the item ({ position, audioId, audio }), not the playlist. */
  addItem(id: number, audioId: number): Observable<PlaylistItem | null> {
    return this.http
      .post<unknown>(`${this.one(id)}/items`, { audioId })
      .pipe(map((body) => normalizePlaylistItem(body)));
  }

  removeItem(id: number, audioId: number): Observable<void> {
    return this.http.delete<void>(`${this.one(id)}/items/${audioId}`);
  }

  /** Preferred body is { audioIds }. The server also accepts a raw array. */
  reorder(id: number, audioIds: number[]): Observable<Playlist | null> {
    return this.http
      .put<unknown>(`${this.one(id)}/items`, { audioIds })
      .pipe(map((body) => normalizePlaylist(body)));
  }

  /** Replaces the playlist's tags. The response includes items and tags. */
  replaceTags(id: number, tags: string[]): Observable<Playlist | null> {
    return this.http
      .put<unknown>(`${this.one(id)}/tags`, { tags })
      .pipe(map((body) => normalizePlaylist(body)));
  }

  private collection(): string {
    return this.config.url(API_PATHS.playlists);
  }

  private one(id: number): string {
    return `${this.collection()}/${id}`;
  }
}
