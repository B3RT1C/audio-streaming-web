import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { API_PATHS, Track } from '../models/track';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private http = inject(HttpClient);
  private readonly audiosUrl = `${environment.apiUrl}${API_PATHS.audios}`;

  getAllAudioDatas(): Observable<Track[]> {
    return this.http.get<Track[]>(this.audiosUrl);
  }

  postAudioFile(file: File, name?: string): Observable<AudioResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (name?.trim()) {
      formData.append('name', name.trim());
    }
    return this.http.post<AudioResponse>(this.audiosUrl, formData);
  }

  deleteSong(id: number): Observable<void> {
    return this.http.delete<void>(`${this.audiosUrl}/${id}`);
  }
}

export interface AudioResponse {
  message: string;
}

export type AudioDataModel = Track;
