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
  private readonly songUrl = `${environment.apiUrl}${API_PATHS.songs}`;

  getAllAudioDatas(): Observable<Track[]> {
    return this.http.get<Track[]>(this.songUrl);
  }

  postAudioFile(file: File): Observable<AudioResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<AudioResponse>(`${this.songUrl}/file`, formData);
  }

  deleteSong(id: number): Observable<void> {
    return this.http.delete<void>(this.songUrl, { params: { id } });
  }
}

export interface AudioResponse {
  message: string;
}

export type AudioDataModel = Track;
