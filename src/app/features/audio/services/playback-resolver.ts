import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { API_PATHS } from '../models/track';

@Injectable({
  providedIn: 'root',
})
export class PlaybackResolver {
  private config = inject(RuntimeConfigService);

  resolvePlaybackUrl(trackId: number): string {
    return this.config.url(`${API_PATHS.audios}/${trackId}`);
  }
}
