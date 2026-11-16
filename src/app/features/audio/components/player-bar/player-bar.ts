import { AfterViewInit, Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { trackSubtitle, trackTitle } from '../../models/track';
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
  protected readonly subtitleOf = trackSubtitle;
  protected readonly cover = coverArt;
  protected readonly clock = (value: number) => formatClock(value, '0:00');

  readonly progress = computed(() => {
    const duration = this.player.duration();
    if (!duration) {
      return 0;
    }
    return Math.min(100, (this.player.currentTime() / duration) * 100);
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
      this.expanded.set(true);
    }
  }

  close(): void {
    this.expanded.set(false);
  }

  togglePlay(event: Event): void {
    event.stopPropagation();
    this.player.toggle();
  }
}
