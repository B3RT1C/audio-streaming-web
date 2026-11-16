import { HttpClient, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { API_PATHS, normalizeTrack, normalizeTrackList, Track, TrackMetadataPatch } from '../models/track';

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

  list(query = ''): Observable<Track[]> {
    const q = query.trim();
    const params = q ? new HttpParams().set('q', q) : undefined;
    return this.http
      .get<unknown>(this.audiosUrl(), { params })
      .pipe(map((body) => normalizeTrackList(body)));
  }

  updateMetadata(id: number, patch: TrackMetadataPatch): Observable<Track | null> {
    return this.http
      .patch<unknown>(`${this.audiosUrl()}/${id}`, patch)
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
