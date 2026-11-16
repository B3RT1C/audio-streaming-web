import { Component, input, output, signal } from '@angular/core';
import { Track, TrackRow, trackSubtitle, trackTitle } from '../../models/track';
import { coverArt } from '../../utils/cover-art';
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
  readonly emptyMessage = input('No hay canciones.');
  readonly mode = input<'library' | 'playlist'>('library');

  readonly selected = output<Track>();
  readonly edit = output<Track>();
  readonly add = output<Track>();
  readonly remove = output<number>();
  readonly delete = output<Track>();
  readonly move = output<{ audioId: number; direction: -1 | 1 }>();
  readonly reordered = output<number[]>();

  readonly menuId = signal<number | null>(null);
  readonly dragOver = signal(-1);

  protected readonly titleOf = trackTitle;
  protected readonly subtitleOf = trackSubtitle;
  protected readonly clock = formatClock;
  protected readonly cover = coverArt;

  private dragFrom = -1;

  openEntry(): TrackRow | null {
    const id = this.menuId();
    if (id == null) {
      return null;
    }
    return this.entries().find((entry) => entry.audioId === id) ?? null;
  }

  coverSeed(entry: TrackRow): string {
    const track = entry.track;
    return track?.album?.trim() || track?.artist?.trim() || (track ? trackTitle(track) : 'Música');
  }

  toggleMenu(audioId: number, event: Event): void {
    event.stopPropagation();
    this.menuId.update((current) => (current === audioId ? null : audioId));
  }

  closeMenu(): void {
    this.menuId.set(null);
  }

  requestDelete(track: Track): void {
    this.closeMenu();
    if (confirm(`¿Eliminar "${trackTitle(track)}" de la biblioteca?`)) {
      this.delete.emit(track);
    }
  }

  requestRemove(audioId: number): void {
    this.closeMenu();
    this.remove.emit(audioId);
  }

  requestEdit(track: Track): void {
    this.closeMenu();
    this.edit.emit(track);
  }

  requestAdd(track: Track): void {
    this.closeMenu();
    this.add.emit(track);
  }

  onGripKey(index: number, event: KeyboardEvent): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    const entry = this.entries()[index];
    if (!entry) {
      return;
    }
    this.move.emit({ audioId: entry.audioId, direction: event.key === 'ArrowUp' ? -1 : 1 });
  }

  onGripDown(index: number, event: PointerEvent): void {
    if (this.mode() !== 'playlist') {
      return;
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragFrom = index;
    this.dragOver.set(index);
  }

  onGripMove(event: PointerEvent): void {
    if (this.dragFrom < 0) {
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-index]');
    if (!target) {
      return;
    }
    const index = Number(target.getAttribute('data-index'));
    if (Number.isInteger(index)) {
      this.dragOver.set(index);
    }
  }

  onGripUp(): void {
    const from = this.dragFrom;
    const to = this.dragOver();
    this.dragFrom = -1;
    this.dragOver.set(-1);
    if (from < 0 || to < 0 || from === to) {
      return;
    }
    const ids = this.entries().map((entry) => entry.audioId);
    const [moved] = ids.splice(from, 1);
    if (moved == null) {
      return;
    }
    ids.splice(to, 0, moved);
    this.reordered.emit(ids);
  }
}
