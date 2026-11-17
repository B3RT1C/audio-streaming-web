import { Component, input, output } from '@angular/core';
import { Playlist } from '../../models/playlist';
import { Track, trackSecondary, trackTitle } from '../../models/track';

@Component({
  selector: 'app-playlist-picker',
  templateUrl: './playlist-picker.html',
  styleUrl: './playlist-picker.scss',
})
export class PlaylistPicker {
  readonly track = input.required<Track>();
  readonly playlists = input<Playlist[]>([]);

  readonly picked = output<Playlist>();
  readonly closed = output<void>();

  protected readonly titleOf = trackTitle;
  protected readonly secondaryOf = trackSecondary;

  close(): void {
    this.closed.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}
