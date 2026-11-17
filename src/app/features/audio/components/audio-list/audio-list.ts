import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Track, TrackRow, trackSecondary, trackSubtitle, trackTitle } from '../../models/track';
import { coverArt } from '../../utils/cover-art';
import { formatClock } from '../../utils/format-time';
import { layoutRows, visibleRange } from '../../utils/virtual-window';

/** Above this size only the rows near the viewport are rendered. */
export const VIRTUAL_THRESHOLD = 100;
const ROW_BASE = 76;
const ROW_ALT = 18;
const ROW_TAGS = 42;

export function trackRowHeight(entry: TrackRow): number {
  let height = ROW_BASE;
  if (entry.track?.secondaryTitle?.trim()) {
    height += ROW_ALT;
  }
  if ((entry.track?.tags.length ?? 0) > 0) {
    height += ROW_TAGS;
  }
  return height;
}

interface VisibleRow {
  entry: TrackRow;
  index: number;
  top: number;
  height: number;
}

@Component({
  selector: 'app-audio-list',
  templateUrl: './audio-list.html',
  styleUrl: './audio-list.scss',
})
export class AudioList {
  private readonly host = inject(ElementRef<HTMLElement>);

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
  readonly tagSelected = output<string>();

  readonly menuId = signal<number | null>(null);
  readonly dragOver = signal(-1);
  private readonly range = signal({ start: 0, end: 24 });

  protected readonly titleOf = trackTitle;
  protected readonly secondaryOf = trackSecondary;
  protected readonly subtitleOf = trackSubtitle;
  protected readonly clock = formatClock;
  protected readonly cover = coverArt;

  private dragFrom = -1;

  readonly virtual = computed(() => this.entries().length > VIRTUAL_THRESHOLD);

  readonly layout = computed(() => layoutRows(this.entries().map((entry) => trackRowHeight(entry))));

  readonly rows = computed<VisibleRow[]>(() => {
    const entries = this.entries();
    const spans = this.layout().spans;
    const range = this.virtual() ? this.range() : { start: 0, end: entries.length };
    const start = Math.max(0, Math.min(range.start, entries.length));
    const end = Math.max(start, Math.min(range.end, entries.length));
    const rows: VisibleRow[] = [];
    for (let index = start; index < end; index += 1) {
      const entry = entries[index];
      const span = spans[index];
      if (!entry || !span) {
        continue;
      }
      rows.push({ entry, index, top: span.top, height: span.height });
    }
    return rows;
  });

  constructor() {
    effect(() => {
      this.entries();
      queueMicrotask(() => this.measure());
    });
    afterNextRender(() => this.measure());
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  measure(): void {
    if (!this.virtual()) {
      return;
    }
    const rect = this.host.nativeElement.getBoundingClientRect();
    const listTop = rect.top + window.scrollY;
    const viewTop = window.scrollY - listTop - 280;
    const viewBottom = window.scrollY + (window.innerHeight || 800) - listTop + 420;
    const next = visibleRange(this.layout().spans, viewTop, viewBottom, 6);
    const current = this.range();
    if (current.start !== next.start || current.end !== next.end) {
      this.range.set(next);
    }
  }

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

  pickTag(tag: string, event: Event): void {
    event.stopPropagation();
    this.tagSelected.emit(tag);
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
    if (event.clientY < 96) {
      window.scrollBy(0, -28);
    } else if (event.clientY > window.innerHeight - 140) {
      window.scrollBy(0, 28);
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
