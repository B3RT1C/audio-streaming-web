import { Component, input, OnInit, output, signal } from '@angular/core';
import { Track, TrackMetadataPatch, trackTitle } from '../../models/track';

@Component({
  selector: 'app-metadata-dialog',
  templateUrl: './metadata-dialog.html',
  styleUrl: './metadata-dialog.scss',
})
export class MetadataDialog implements OnInit {
  readonly track = input.required<Track>();
  readonly busy = input(false);

  readonly saved = output<TrackMetadataPatch>();
  readonly cancelled = output<void>();

  readonly title = signal('');
  readonly artist = signal('');
  readonly album = signal('');
  readonly trackNumber = signal('');
  readonly formError = signal('');

  ngOnInit(): void {
    const track = this.track();
    this.title.set(trackTitle(track));
    this.artist.set(track.artist ?? '');
    this.album.set(track.album ?? '');
    this.trackNumber.set(track.trackNumber == null ? '' : String(track.trackNumber));
  }

  onTitle(event: Event): void {
    this.title.set((event.target as HTMLInputElement).value);
  }

  onArtist(event: Event): void {
    this.artist.set((event.target as HTMLInputElement).value);
  }

  onAlbum(event: Event): void {
    this.album.set((event.target as HTMLInputElement).value);
  }

  onTrackNumber(event: Event): void {
    this.trackNumber.set((event.target as HTMLInputElement).value);
  }

  save(): void {
    const title = this.title().trim();
    if (!title) {
      this.formError.set('El título no puede quedar vacío.');
      return;
    }
    const rawNumber = this.trackNumber().trim();
    let trackNumber: number | null = null;
    if (rawNumber) {
      if (!/^\d+$/.test(rawNumber) || Number(rawNumber) < 1) {
        this.formError.set('El número de pista tiene que ser un entero positivo.');
        return;
      }
      trackNumber = Number(rawNumber);
    }
    this.formError.set('');
    this.saved.emit({
      title,
      artist: this.artist().trim(),
      album: this.album().trim(),
      trackNumber,
    });
  }

  cancel(): void {
    if (this.busy()) {
      return;
    }
    this.cancelled.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }
}
