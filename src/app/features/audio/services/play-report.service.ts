import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { API_PATHS } from '../models/track';
import {
  changeListen,
  closeListen,
  createListenMachine,
  ListenMachine,
  ListenSnapshot,
  peekListen,
  PlayOrigin,
  sampleListen,
  seekListen,
} from '../utils/listen-clock';
import {
  createClientEventId,
  enqueuePlayEvent,
  flushPlayQueue,
  loadPlayQueue,
  localStorageQueue,
  PlayEvent,
  playEventBody,
  PlayPostDisposition,
  playPostDisposition,
  postPlayKeepalive,
  QueueStorage,
  sendQueuedPlays,
  snapshotToPlayEvent,
} from '../utils/play-event-queue';

@Injectable({
  providedIn: 'root',
})
export class PlayReportService {
  private http = inject(HttpClient);
  private config = inject(RuntimeConfigService);
  private machine: ListenMachine = createListenMachine();
  private origin: PlayOrigin = { source: 'library' };
  private storage: QueueStorage = queueStorage();
  private flushing: Promise<void> = Promise.resolve();

  setOrigin(origin: PlayOrigin): void {
    const playlistId =
      origin.playlistId != null && Number.isInteger(origin.playlistId) && origin.playlistId > 0
        ? origin.playlistId
        : undefined;
    this.origin = playlistId != null ? { source: origin.source, playlistId } : { source: origin.source };
  }

  /** Closes the previous listen and starts one for `audioId`. */
  open(audioId: number, completed = false): void {
    const result = changeListen(
      this.machine,
      {
        audioId,
        startedAt: new Date().toISOString(),
        clientEventId: createClientEventId(),
        origin: this.origin,
      },
      completed,
    );
    this.machine = result.state;
    this.persist(result.snapshot);
  }

  close(completed: boolean): void {
    const result = closeListen(this.machine, completed);
    this.machine = result.state;
    this.persist(result.snapshot);
  }

  sample(positionSeconds: number, playing: boolean): void {
    this.machine = sampleListen(this.machine, positionSeconds, playing);
  }

  seek(positionSeconds: number): void {
    this.machine = seekListen(this.machine, positionSeconds);
  }

  /** Page is going away. The session stays open so a restored page can keep the same id. */
  unload(): void {
    this.persist(peekListen(this.machine, false), false);
    sendQueuedPlays(this.playsUrl(), loadPlayQueue(this.storage), (url, body) => postPlayKeepalive(url, body));
  }

  retryPending(): void {
    this.scheduleFlush();
  }

  private persist(snapshot: ListenSnapshot | null, flush = true): void {
    const event = snapshotToPlayEvent(snapshot);
    if (!event) {
      return;
    }
    enqueuePlayEvent(this.storage, event);
    if (flush) {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    this.flushing = this.flushing.then(() => this.flushNow()).catch(() => undefined);
  }

  private async flushNow(): Promise<void> {
    await flushPlayQueue(this.storage, (event) => this.deliver(event));
  }

  private async deliver(event: PlayEvent): Promise<PlayPostDisposition> {
    try {
      const response = await firstValueFrom(
        this.http.post<unknown>(this.playsUrl(), playEventBody(event), { observe: 'response' }),
      );
      return playPostDisposition(response.status);
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      return playPostDisposition(status);
    }
  }

  private playsUrl(): string {
    return this.config.url(API_PATHS.plays);
  }
}

function queueStorage(): QueueStorage {
  if (typeof localStorage === 'undefined') {
    return { read: () => null, write: () => undefined };
  }
  return localStorageQueue(localStorage);
}
