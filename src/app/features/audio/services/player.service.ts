import { computed, inject, Injectable, signal } from '@angular/core';
import { Track, trackSecondary, trackTitle } from '../models/track';
import {
  advance,
  createQueueCursor,
  mulberry32,
  nextRepeatMode,
  QueueCursor,
  randomSeed,
  RepeatMode,
  replaceQueue,
  shuffledIndices,
  withShuffle,
} from '../utils/playback-queue';
import { playbackErrorMessage } from '../utils/api-error';
import { PlayOrigin } from '../utils/listen-clock';
import { PlaybackResolver } from './playback-resolver';
import { PlayReportService } from './play-report.service';

export interface PlayOrderItem {
  index: number;
  track: Track;
  current: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  private resolver = inject(PlaybackResolver);
  private report = inject(PlayReportService);
  private audio: HTMLAudioElement | null = null;
  private pageHideBound = false;
  private readonly cursorState = signal<QueueCursor>(createQueueCursor(0, -1));
  private readonly onPageHide = () => {
    this.capturePosition();
    this.report.unload();
  };

  readonly queue = signal<Track[]>([]);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly playing = signal(false);
  readonly error = signal('');

  readonly shuffle = computed(() => this.cursorState().shuffle);
  readonly repeat = computed(() => this.cursorState().repeat);
  readonly currentIndex = computed(() => this.cursorState().index);
  readonly current = computed(() => {
    const tracks = this.queue();
    const index = this.cursorState().index;
    return index >= 0 && index < tracks.length ? tracks[index] : null;
  });
  readonly playOrder = computed<PlayOrderItem[]>(() => {
    const tracks = this.queue();
    const cursor = this.cursorState();
    const indices =
      cursor.shuffle && cursor.order.length === tracks.length
        ? cursor.order
        : tracks.map((_, index) => index);
    return indices
      .map((index) => ({
        index,
        track: tracks[index],
        current: index === cursor.index,
      }))
      .filter((item): item is PlayOrderItem => item.track != null);
  });

  bind(audio: HTMLAudioElement): void {
    if (this.audio === audio) {
      return;
    }
    this.audio = audio;
    audio.addEventListener('timeupdate', () => {
      const position = audio.currentTime || 0;
      this.currentTime.set(position);
      this.report.sample(position, !audio.paused);
      this.publishPosition();
    });
    audio.addEventListener('loadedmetadata', () => {
      const nextDuration = audio.duration;
      this.duration.set(Number.isFinite(nextDuration) ? nextDuration : 0);
      this.publishPosition();
    });
    audio.addEventListener('play', () => {
      this.playing.set(true);
      this.publishPlaybackState();
    });
    audio.addEventListener('pause', () => {
      this.playing.set(false);
      this.publishPlaybackState();
    });
    audio.addEventListener('ended', () => {
      const position = Number.isFinite(audio.currentTime) ? audio.currentTime : this.currentTime();
      this.report.sample(position, true);
      this.onEnded();
    });
    audio.addEventListener('error', () => {
      if (!audio.getAttribute('src')) {
        return;
      }
      this.error.set(playbackErrorMessage());
      this.playing.set(false);
    });
    this.installMediaSession();
    this.bindPageHide();
    this.report.retryPending();
    if (this.current()) {
      this.loadCurrent(false);
    }
  }

  playTracks(tracks: Track[], startId?: number, origin?: PlayOrigin): void {
    const startIndex =
      startId == null ? 0 : Math.max(0, tracks.findIndex((track) => track.id === startId));
    this.capturePosition();
    if (origin) {
      this.report.setOrigin(origin);
    }
    this.queue.set(tracks);
    this.cursorState.set(
      replaceQueue(tracks.length, startIndex, this.cursorState(), Math.random),
    );
    this.error.set('');
    this.loadCurrent(true);
  }

  /**
   * Plays `tracks` in a deterministic random order. The current track stays
   * first in that order, and nothing repeats until every track has played.
   */
  playShuffled(tracks: Track[], seed: number = randomSeed(), origin?: PlayOrigin): void {
    if (tracks.length === 0) {
      return;
    }
    const order = shuffledIndices(tracks.length, -1, mulberry32(seed >>> 0));
    this.capturePosition();
    if (origin) {
      this.report.setOrigin(origin);
    }
    this.queue.set(tracks);
    this.cursorState.set({
      index: order[0] ?? 0,
      shuffle: true,
      repeat: this.cursorState().repeat,
      order,
      cursor: 0,
    });
    this.error.set('');
    this.loadCurrent(true);
  }

  toggle(): void {
    const audio = this.audio;
    if (!audio) {
      return;
    }
    if (this.queue().length === 0) {
      return;
    }
    if (!this.current() || !audio.src) {
      this.playTracks(this.queue(), this.queue()[0]?.id);
      return;
    }
    if (audio.paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  next(): void {
    this.capturePosition();
    this.applyAdvance('next');
  }

  previous(): void {
    this.capturePosition();
    this.applyAdvance('previous');
  }

  jumpTo(index: number): void {
    const length = this.queue().length;
    if (index < 0 || index >= length) {
      return;
    }
    this.capturePosition();
    this.cursorState.update((cursor) => {
      if (!cursor.shuffle) {
        return { ...cursor, index };
      }
      const position = cursor.order.indexOf(index);
      return { ...cursor, index, cursor: position >= 0 ? position : cursor.cursor };
    });
    this.loadCurrent(true);
  }

  seek(seconds: number): void {
    const audio = this.audio;
    if (!audio || !Number.isFinite(seconds)) {
      return;
    }
    this.capturePosition();
    const duration = Number.isFinite(audio.duration) ? audio.duration : this.duration();
    const next = Math.min(Math.max(0, seconds), duration || seconds);
    this.report.seek(next);
    audio.currentTime = next;
    this.currentTime.set(next);
    this.publishPosition();
  }

  toggleShuffle(): void {
    const enabled = !this.cursorState().shuffle;
    this.cursorState.update((cursor) => withShuffle(cursor, this.queue().length, enabled));
  }

  cycleRepeat(): void {
    this.cursorState.update((cursor) => ({ ...cursor, repeat: nextRepeatMode(cursor.repeat) }));
  }

  stop(): void {
    const audio = this.audio;
    if (!audio) {
      this.playing.set(false);
      this.currentTime.set(0);
      return;
    }
    this.capturePosition();
    this.report.seek(0);
    audio.pause();
    audio.currentTime = 0;
    this.currentTime.set(0);
    this.playing.set(false);
    this.publishPlaybackState();
  }

  removeTrack(id: number): void {
    const tracks = this.queue();
    const removedAt = tracks.findIndex((track) => track.id === id);
    if (removedAt < 0) {
      return;
    }
    const currentId = this.current()?.id;
    const wasCurrent = currentId === id;
    const wasPlaying = this.playing();
    const nextQueue = tracks.filter((track) => track.id !== id);
    this.queue.set(nextQueue);
    if (wasCurrent) {
      this.capturePosition();
    }
    if (nextQueue.length === 0) {
      this.cursorState.set(createQueueCursor(0, -1));
      this.report.close(false);
      this.clearElement();
      return;
    }
    const keptIndex = nextQueue.findIndex((track) => track.id === currentId);
    const nextIndex = wasCurrent ? Math.min(removedAt, nextQueue.length - 1) : Math.max(0, keptIndex);
    this.cursorState.set(replaceQueue(nextQueue.length, nextIndex, this.cursorState(), Math.random));
    if (wasCurrent) {
      this.loadCurrent(wasPlaying);
    }
  }

  syncCatalog(tracks: Track[]): void {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    this.queue.update((queue) => queue.map((track) => byId.get(track.id) ?? track));
    this.publishMetadata();
  }

  repeatLabel(mode: RepeatMode = this.repeat()): string {
    if (mode === 'one') {
      return 'Repetir una';
    }
    if (mode === 'all') {
      return 'Repetir todo';
    }
    return 'Sin repetición';
  }

  shuffleLabel(): string {
    return this.shuffle()
      ? 'Aleatorio activo. Sin repetir hasta acabar la cola'
      : 'Aleatorio';
  }

  private capturePosition(forcePlaying = false): void {
    const audio = this.audio;
    if (!audio) {
      return;
    }
    const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    this.report.sample(position, forcePlaying || !audio.paused);
  }

  private bindPageHide(): void {
    if (this.pageHideBound || typeof window === 'undefined') {
      return;
    }
    this.pageHideBound = true;
    window.addEventListener('pagehide', this.onPageHide);
  }

  private onEnded(): void {
    this.applyAdvance('ended');
  }

  private applyAdvance(reason: 'ended' | 'next' | 'previous'): void {
    const result = advance(
      this.cursorState(),
      this.queue().length,
      reason,
      this.audio?.currentTime ?? this.currentTime(),
    );
    this.cursorState.set(result.cursor);
    if (result.stopped) {
      this.report.close(reason === 'ended');
      this.pause();
      return;
    }
    if (result.restart) {
      if (reason === 'ended') {
        const id = this.current()?.id;
        if (id != null) {
          this.report.open(id, true);
          this.report.seek(0);
        }
        const audio = this.audio;
        if (audio) {
          audio.currentTime = 0;
          this.currentTime.set(0);
        }
        this.resume();
        return;
      }
      this.seek(0);
      if (this.playing()) {
        this.resume();
      }
      return;
    }
    this.loadCurrent(true, reason === 'ended' ? 'completed' : 'changed');
  }

  private loadCurrent(autoplay: boolean, end: 'completed' | 'changed' = 'changed'): void {
    const track = this.current();
    const audio = this.audio;
    if (!track) {
      this.report.close(end === 'completed');
      this.clearElement();
      return;
    }
    this.report.open(track.id, end === 'completed');
    this.currentTime.set(0);
    this.duration.set(track.durationSeconds ?? 0);
    this.publishMetadata();
    if (!audio) {
      return;
    }
    audio.src = this.resolver.resolvePlaybackUrl(track.id);
    audio.load();
    if (autoplay) {
      this.resume();
    }
  }

  private resume(): void {
    const audio = this.audio;
    if (!audio) {
      return;
    }
    const pending = audio.play();
    if (pending && typeof pending.catch === 'function') {
      void pending.catch(() => {
        this.error.set(playbackErrorMessage());
        this.playing.set(false);
      });
    }
  }

  private pause(): void {
    this.audio?.pause();
    this.playing.set(false);
    this.publishPlaybackState();
  }

  private clearElement(): void {
    const audio = this.audio;
    this.currentTime.set(0);
    this.duration.set(0);
    this.playing.set(false);
    if (!audio) {
      return;
    }
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    this.publishMetadata();
  }

  private installMediaSession(): void {
    const session = navigator.mediaSession;
    if (!session) {
      return;
    }
    this.setHandler('play', () => this.resume());
    this.setHandler('pause', () => this.pause());
    this.setHandler('previoustrack', () => this.previous());
    this.setHandler('nexttrack', () => this.next());
    this.setHandler('stop', () => this.stop());
    this.setHandler('seekto', (details) => {
      if (details.seekTime != null) {
        this.seek(details.seekTime);
      }
    });
    this.setHandler('seekbackward', (details) => {
      this.seek(this.currentTime() - (details.seekOffset ?? 10));
    });
    this.setHandler('seekforward', (details) => {
      this.seek(this.currentTime() + (details.seekOffset ?? 10));
    });
  }

  private setHandler(
    action: MediaSessionAction,
    handler: MediaSessionActionHandler,
  ): void {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // This action is not supported on the current platform.
    }
  }

  private publishMetadata(): void {
    const session = navigator.mediaSession;
    if (!session || typeof MediaMetadata === 'undefined') {
      return;
    }
    const track = this.current();
    if (!track) {
      session.metadata = null;
      this.publishPlaybackState();
      return;
    }
    const secondary = trackSecondary(track);
    const artist = track.artist?.trim() ?? '';
    session.metadata = new MediaMetadata({
      title: trackTitle(track),
      artist: [secondary, artist].filter(Boolean).join(' · ') || 'Música',
      album: track.album?.trim() || '',
      artwork: this.artwork(),
    });
    this.publishPlaybackState();
  }

  private publishPlaybackState(): void {
    const session = navigator.mediaSession;
    if (!session) {
      return;
    }
    session.playbackState = this.playing() ? 'playing' : 'paused';
  }

  private publishPosition(): void {
    const session = navigator.mediaSession;
    if (!session?.setPositionState) {
      return;
    }
    const duration = this.duration();
    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }
    const position = Math.min(Math.max(0, this.currentTime()), duration);
    try {
      session.setPositionState({
        duration,
        playbackRate: this.audio?.playbackRate || 1,
        position,
      });
    } catch {
      // Ignore out-of-range updates while metadata is still loading.
    }
  }

  private artwork(): MediaImage[] {
    if (typeof document === 'undefined') {
      return [];
    }
    try {
      const src = new URL('icons/icon-192.png', document.baseURI).toString();
      return [{ src, sizes: '192x192', type: 'image/png' }];
    } catch {
      return [];
    }
  }
}
