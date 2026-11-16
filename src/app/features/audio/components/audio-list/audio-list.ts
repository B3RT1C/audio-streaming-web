import { Component, input, output } from '@angular/core';
import { Track, TrackRow, trackSubtitle, trackTitle } from '../../models/track';
import { formatClock } from '../../utils/format-time';

@Component({
  selector: 'app-audio-list',
  templateUrl: './audio-list.html',
  styleUrl: './audio-list.scss',
})
export class AudioList {
  readonly entries = input<TrackRow[]>([]);
  readonly selectedId = input(-1);
  readonly loading = input(false);
  readonly errorMessage = input('');
  readonly emptyMessage = input('No hay canciones. Sube un audio para empezar.');
  readonly mode = input<'library' | 'playlist'>('library');

  readonly selected = output<Track>();
  readonly edit = output<Track>();
  readonly add = output<Track>();
  readonly remove = output<number>();
  readonly delete = output<Track>();
  readonly move = output<{ audioId: number; direction: -1 | 1 }>();

  protected readonly titleOf = trackTitle;
  protected readonly subtitleOf = trackSubtitle;
  protected readonly clock = formatClock;

  requestDelete(track: Track, event: Event): void {
    event.stopPropagation();
    if (confirm(`¿Eliminar "${trackTitle(track)}" de la biblioteca?`)) {
      this.delete.emit(track);
    }
  }

  requestRemove(audioId: number, event: Event): void {
    event.stopPropagation();
    this.remove.emit(audioId);
  }

  requestMove(audioId: number, direction: -1 | 1, event: Event): void {
    event.stopPropagation();
    this.move.emit({ audioId, direction });
  }
}
