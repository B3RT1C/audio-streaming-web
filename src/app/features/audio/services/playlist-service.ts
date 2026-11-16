import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { normalizePlaylist, normalizePlaylistList, Playlist } from '../models/playlist';
import { API_PATHS } from '../models/track';

@Injectable({
  providedIn: 'root',
})
export class PlaylistService {
  private http = inject(HttpClient);
  private config = inject(RuntimeConfigService);

  list(): Observable<Playlist[]> {
    return this.http.get<unknown>(this.collection()).pipe(map((body) => normalizePlaylistList(body)));
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

  addItem(id: number, audioId: number): Observable<Playlist | null> {
    return this.http
      .post<unknown>(`${this.one(id)}/items`, { audioId })
      .pipe(map((body) => normalizePlaylist(body)));
  }

  removeItem(id: number, audioId: number): Observable<void> {
    return this.http.delete<void>(`${this.one(id)}/items/${audioId}`);
  }

  /** PUT body is the ordered list of audio ids. */
  reorder(id: number, audioIds: number[]): Observable<Playlist | null> {
    return this.http
      .put<unknown>(`${this.one(id)}/items`, audioIds)
      .pipe(map((body) => normalizePlaylist(body)));
  }

  private collection(): string {
    return this.config.url(API_PATHS.playlists);
  }

  private one(id: number): string {
    return `${this.collection()}/${id}`;
  }
}
