import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { API_PATHS } from '../models/track';

@Injectable({
  providedIn: 'root',
})
export class PlaybackResolver {
  private readonly remoteApiUrl = environment.apiUrl;

  resolvePlaybackUrl(trackId: number): string {
    return `${this.remoteApiUrl}${API_PATHS.audios}/${trackId}`;
  }
}
