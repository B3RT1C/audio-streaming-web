import {
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AudioDataModel, AudioService } from '../../services/audio-service';
import { PlaybackResolver } from '../../services/playback-resolver';
import { AudioList } from '../../components/audio-list/audio-list';

@Component({
  selector: 'app-audio-player',
  imports: [AudioList],
  templateUrl: './audio-player.html',
  styleUrl: './audio-player.scss',
})
export class AudioPlayer implements OnInit {
  private audioService = inject(AudioService);
  private playbackResolver = inject(PlaybackResolver);

  @ViewChild('audioPlayer') audioPlayer!: ElementRef<HTMLAudioElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  audioUrl = '';
  loadedMusicDatas = signal<AudioDataModel[]>([]);
  playingId = signal<number>(-1);
  loading = signal(false);
  errorMessage = signal('');
  uploadMessage = signal('');
  uploading = signal(false);
  isDragging = signal(false);

  currentTime = signal(0);
  duration = signal(0);
  isPlaying = signal(false);

  currentTrack = computed(() => {
    const id = this.playingId();
    return this.loadedMusicDatas().find((track) => track.id === id) ?? null;
  });

  trackCount = computed(() => this.loadedMusicDatas().length);

  ngOnInit(): void {
    this.getAllAudioDatas();
  }

  public loadAudio(toPlayId: number): void {
    this.prepareTrack(toPlayId, true);
  }

  public togglePlayPause(): void {
    const player = this.audioPlayer.nativeElement;
    const tracks = this.loadedMusicDatas();

    if (player.paused) {
      if (tracks.length === 0) {
        return;
      }

      if (this.playingId() === -1 || !player.src) {
        this.prepareTrack(tracks[0].id, true);
        return;
      }

      void player.play();
    } else {
      player.pause();
    }
  }

  public play(): void {
    void this.audioPlayer.nativeElement.play();
  }

  public stop(): void {
    const player = this.audioPlayer.nativeElement;
    player.pause();
    player.currentTime = 0;
    this.currentTime.set(0);
    this.isPlaying.set(false);
  }

  public nextAudio(): void {
    const tracks = this.loadedMusicDatas();
    if (tracks.length === 0) {
      return;
    }

    const currentIndex = this.getCurrentTrackIndex();
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % tracks.length;
    this.loadAudio(tracks[nextIndex].id);
  }

  public previousAudio(): void {
    const tracks = this.loadedMusicDatas();
    if (tracks.length === 0) {
      return;
    }

    const currentIndex = this.getCurrentTrackIndex();
    const previousIndex = currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1;
    this.loadAudio(tracks[previousIndex].id);
  }

  public onTimeUpdate(): void {
    this.currentTime.set(this.audioPlayer.nativeElement.currentTime);
  }

  public onLoadedMetadata(): void {
    this.duration.set(this.audioPlayer.nativeElement.duration);
  }

  public onPlay(): void {
    this.isPlaying.set(true);
  }

  public onPause(): void {
    this.isPlaying.set(false);
  }

  public onSeek(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.audioPlayer.nativeElement.currentTime = value;
    this.currentTime.set(value);
  }

  public formatTime(seconds: number): string {
    if (!seconds || !Number.isFinite(seconds)) {
      return '0:00';
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  public openFilePicker(): void {
    this.fileInput.nativeElement.click();
  }

  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.uploadFiles(Array.from(input.files));
      input.value = '';
    }
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  public onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  public onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);

    const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
      file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3')
    );

    if (files.length > 0) {
      this.uploadFiles(files);
    }
  }

  public uploadFiles(files: File[]): void {
    if (files.length === 0) {
      return;
    }

    this.uploading.set(true);
    this.uploadMessage.set('Subiendo...');
    this.errorMessage.set('');

    let completedUploads = 0;
    let failedUploads = 0;
    let firstFailureMessage: string | null = null;

    for (const file of files) {
      this.audioService.postAudioFile(file).subscribe({
        next: () => {
          completedUploads++;
          this.finishUploadBatch(
            completedUploads,
            failedUploads,
            files.length,
            firstFailureMessage
          );
        },
        error: (err: unknown) => {
          failedUploads++;
          if (!firstFailureMessage) {
            firstFailureMessage = this.getFriendlyUploadErrorMessage(err);
          }

          this.finishUploadBatch(
            completedUploads,
            failedUploads,
            files.length,
            firstFailureMessage
          );
        },
      });
    }
  }

  public deleteAudio(track: AudioDataModel): void {
    this.audioService.deleteSong(track.id).subscribe({
      next: () => {
        if (this.playingId() === track.id) {
          this.stop();
          this.playingId.set(-1);
          this.audioUrl = '';
          this.audioPlayer.nativeElement.removeAttribute('src');
        }

        this.getAllAudioDatas();
      },
      error: (err: unknown) => {
        const serverMessage = this.extractBackendMessage(err);
        this.errorMessage.set(serverMessage ?? 'No se pudo eliminar la canción.');
      },
    });
  }

  public getAllAudioDatas(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.audioService.getAllAudioDatas().subscribe({
      next: (response) => {
        this.loadedMusicDatas.set(response);
        this.syncTrackSelection(response);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('No se pudo cargar la biblioteca. Comprueba que el backend esté en marcha.');
      },
    });
  }

  private finishUploadBatch(
    completed: number,
    failed: number,
    total: number,
    firstFailureMessage: string | null
  ): void {
    if (completed + failed < total) {
      return;
    }

    this.uploading.set(false);

    if (failed === 0) {
      this.uploadMessage.set(
        total === 1 ? '1 canción añadida.' : `${total} canciones añadidas.`
      );
    } else if (completed === 0) {
      this.uploadMessage.set('');
      this.errorMessage.set(firstFailureMessage ?? 'No se pudieron subir las canciones.');
    } else {
      this.uploadMessage.set(`${completed} de ${total} canciones añadidas.`);
      this.errorMessage.set(firstFailureMessage ?? `Fallaron ${failed} subida(s).`);
    }

    if (completed > 0) {
      this.getAllAudioDatas();
    }
  }

  private prepareTrack(toPlayId: number, autoplay: boolean): void {
    this.audioUrl = this.playbackResolver.resolvePlaybackUrl(toPlayId);
    this.audioPlayer.nativeElement.src = this.audioUrl;
    this.audioPlayer.nativeElement.load();
    this.playingId.set(toPlayId);
    this.currentTime.set(0);
    this.duration.set(0);

    if (autoplay) {
      void this.audioPlayer.nativeElement.play();
    }
  }

  private syncTrackSelection(tracks: AudioDataModel[]): void {
    if (tracks.length === 0) {
      this.playingId.set(-1);
      this.audioUrl = '';
      this.audioPlayer.nativeElement.removeAttribute('src');
      return;
    }

    const currentId = this.playingId();
    const selectedTrack = tracks.find((track) => track.id === currentId) ?? tracks[0];
    this.prepareTrack(selectedTrack.id, false);
  }

  private getCurrentTrackIndex(): number {
    return this.loadedMusicDatas().findIndex((track) => track.id === this.playingId());
  }

  private getFriendlyUploadErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse && err.status === 409) {
      const backendMessage = this.extractBackendMessage(err);
      if (backendMessage) {
        const normalized = backendMessage.toLowerCase();
        if (normalized.includes('name') && normalized.includes('already exists')) {
          return 'Ya existe una canción con ese nombre.';
        }
        if (normalized.includes('content') && normalized.includes('already exists')) {
          return 'Ya existe una canción con el mismo contenido.';
        }
      }

      return 'Ya existe una canción con ese nombre.';
    }

    const backendMessage = this.extractBackendMessage(err);
    return backendMessage ?? 'No se pudo subir la canción.';
  }

  private extractBackendMessage(err: unknown): string | null {
    if (!(err instanceof HttpErrorResponse)) {
      return null;
    }

    const payload = err.error;
    if (!payload) {
      return null;
    }

    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload) as { message?: unknown };
        return typeof parsed?.message === 'string' ? parsed.message : null;
      } catch {
        return null;
      }
    }

    if (typeof payload === 'object' && 'message' in payload) {
      const message = (payload as { message?: unknown }).message;
      return typeof message === 'string' ? message : null;
    }

    return null;
  }
}
