import { AfterViewInit, Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { trackSecondary, trackSubtitle, trackTitle } from '../../models/track';
import { PlayerService } from '../../services/player.service';
import { coverArt } from '../../utils/cover-art';
import { formatClock } from '../../utils/format-time';

@Component({
  selector: 'app-player-bar',
  templateUrl: './player-bar.html',
  styleUrl: './player-bar.scss',
})
export class PlayerBar implements AfterViewInit {
  readonly player = inject(PlayerService);
  readonly expanded = signal(false);

  @ViewChild('audio') audioRef!: ElementRef<HTMLAudioElement>;

  protected readonly titleOf = trackTitle;
  protected readonly secondaryOf = trackSecondary;
  protected readonly subtitleOf = trackSubtitle;
  private readonly queueRow = 58;
  readonly queueStart = signal(0);
  protected readonly cover = coverArt;
  protected readonly clock = (value: number) => formatClock(value, '0:00');

  readonly progress = computed(() => {
    const duration = this.player.duration();
    if (!duration) {
      return 0;
    }
    return Math.min(100, (this.player.currentTime() / duration) * 100);
  });

  readonly visibleQueue = computed(() => {
    const items = this.player.playOrder();
    if (items.length <= 60) {
      return items;
    }
    const start = Math.min(this.queueStart(), Math.max(0, items.length - 24));
    return items.slice(start, start + 28);
  });

  readonly queuePad = computed(() => {
    const total = this.player.playOrder().length;
    if (total <= 60) {
      return { top: 0, bottom: 0 };
    }
    const start = Math.min(this.queueStart(), Math.max(0, total - 24));
    const shown = Math.min(28, total - start);
    return {
      top: start * this.queueRow,
      bottom: Math.max(0, (total - start - shown) * this.queueRow),
    };
  });

  readonly art = computed(() => {
    const track = this.player.current();
    return coverArt(track?.album?.trim() || track?.artist?.trim() || (track ? trackTitle(track) : 'Música'));
  });

  ngAfterViewInit(): void {
    this.player.bind(this.audioRef.nativeElement);
  }

  onSeek(event: Event): void {
    this.player.seek(Number((event.target as HTMLInputElement).value));
  }

  open(): void {
    if (this.player.current()) {
      const order = this.player.playOrder();
      const at = order.findIndex((item) => item.current);
      this.queueStart.set(Math.max(0, (at < 0 ? 0 : at) - 2));
      this.expanded.set(true);
    }
  }

  onQueueScroll(event: Event): void {
    const top = (event.target as HTMLElement).scrollTop;
    this.queueStart.set(Math.max(0, Math.floor(top / this.queueRow) - 4));
  }

  close(): void {
    this.expanded.set(false);
  }

  togglePlay(event: Event): void {
    event.stopPropagation();
    this.player.toggle();
  }
}
