import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PlaybackResolver {
  private readonly remoteApiUrl = environment.apiUrl;

  resolvePlaybackUrl(trackId: number): string {
    return `${this.remoteApiUrl}/song/file?id=${trackId}`;
  }
}
