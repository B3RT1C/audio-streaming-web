import { Component, input, OnInit, output, signal } from '@angular/core';
import { TagSummary, TagType } from '../../models/catalog';
import { Track, TrackEdit, trackTitle } from '../../models/track';
import { assignmentPayload, AssignedTag, namesToAssigned } from '../../utils/tag-assignment';
import { TypedTagEditor } from '../typed-tag-editor/typed-tag-editor';

@Component({
  selector: 'app-metadata-dialog',
  imports: [TypedTagEditor],
  templateUrl: './metadata-dialog.html',
  styleUrl: './metadata-dialog.scss',
})
export class MetadataDialog implements OnInit {
  readonly track = input.required<Track>();
  readonly busy = input(false);
  readonly suggestions = input<string[]>([]);
  readonly catalog = input<TagSummary[]>([]);
  readonly types = input<TagType[]>([]);

  readonly saved = output<TrackEdit>();
  readonly cancelled = output<void>();

  readonly title = signal('');
  readonly secondary = signal('');
  readonly artist = signal('');
  readonly album = signal('');
  readonly trackNumber = signal('');
  readonly assigned = signal<AssignedTag[]>([]);
  readonly formError = signal('');

  private initialTitle = '';

  ngOnInit(): void {
    const track = this.track();
    this.initialTitle = trackTitle(track);
    this.title.set(this.initialTitle);
    this.secondary.set(track.secondaryTitle ?? '');
    this.artist.set(track.artist ?? '');
    this.album.set(track.album ?? '');
    this.trackNumber.set(track.trackNumber == null ? '' : String(track.trackNumber));
    this.assigned.set(track.tagItems?.length ? [...track.tagItems] : namesToAssigned(track.tags));
  }

  onTitle(event: Event): void {
    this.title.set((event.target as HTMLInputElement).value);
  }

  onSecondary(event: Event): void {
    this.secondary.set((event.target as HTMLInputElement).value);
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
    const secondary = this.secondary().trim();
    const assignments = assignmentPayload(this.assigned());
    this.saved.emit({
      patch: {
        ...(title !== this.initialTitle ? { title } : {}),
        secondaryTitle: secondary || null,
        artist: this.artist().trim(),
        album: this.album().trim(),
        trackNumber,
      },
      tags: assignments.map((item) => (typeof item === 'string' ? item : item.name)),
      assignments,
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
