import { AfterViewInit, Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { trackSubtitle, trackTitle } from '../../models/track';
import { PlayerService } from '../../services/player.service';
import { formatClock } from '../../utils/format-time';

@Component({
  selector: 'app-player-bar',
  templateUrl: './player-bar.html',
  styleUrl: './player-bar.scss',
})
export class PlayerBar implements AfterViewInit {
  readonly player = inject(PlayerService);
  readonly queueOpen = signal(false);

  @ViewChild('audio') audioRef!: ElementRef<HTMLAudioElement>;

  protected readonly titleOf = trackTitle;
  protected readonly subtitleOf = trackSubtitle;
  protected readonly clock = (value: number) => formatClock(value, '0:00');

  ngAfterViewInit(): void {
    this.player.bind(this.audioRef.nativeElement);
  }

  onSeek(event: Event): void {
    this.player.seek(Number((event.target as HTMLInputElement).value));
  }

  toggleQueue(): void {
    this.queueOpen.update((open) => !open);
  }
}
