import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private http = inject(HttpClient)

  private url = 'http://localhost:8080/song'

  getAllAudioDatas(): Observable<AudioDataModel[]> {
    return this.http.get<AudioDataModel[]>(this.url)
  }

  getAudioFile(id: number): Observable<ArrayBuffer> {
    let arrayBuffer = this.http.get(this.url + '/file', {
      params: {id: id},
      responseType: 'arraybuffer'
    })
    return arrayBuffer
  }

  postAudioFile(file: File): Observable<AudioResponse> {
    const formData = new FormData()
    formData.append('file', file)
    return this.http.post<AudioResponse>(this.url + '/file', formData)
  }
}

export interface AudioResponse {
  message: string
}

export interface AudioDataModel {
  id: number
  path: string
  name: string
  extension: string
}
