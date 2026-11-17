import { ListenSnapshot, PlaySource } from './listen-clock';

export const PLAY_QUEUE_STORAGE_KEY = 'audio-streaming.play-events';

export interface PlayEvent {
  audioId: number;
  startedAt: string;
  listenedSeconds: number;
  completed: boolean;
  source?: PlaySource;
  playlistId?: number;
  clientEventId: string;
}

export interface QueueStorage {
  read(): string | null;
  write(value: string): void;
}

export type PlayPostDisposition = 'done' | 'retry' | 'drop';

export function memoryQueueStorage(): QueueStorage {
  let raw: string | null = null;
  return {
    read: () => raw,
    write: (value) => {
      raw = value;
    },
  };
}

export function localStorageQueue(storage: Storage, key = PLAY_QUEUE_STORAGE_KEY): QueueStorage {
  return {
    read() {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    write(value: string) {
      try {
        storage.setItem(key, value);
      } catch {
        // Quota or private mode. The caller still attempts the network send.
      }
    },
  };
}

export function createClientEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `play-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

/** Integer seconds. Zero and invalid listens are not events. */
export function snapshotToPlayEvent(snapshot: ListenSnapshot | null): PlayEvent | null {
  if (!snapshot || snapshot.listenedSeconds <= 0 || !snapshot.clientEventId) {
    return null;
  }
  if (!Number.isInteger(snapshot.audioId) || snapshot.audioId <= 0 || !snapshot.startedAt) {
    return null;
  }
  const event: PlayEvent = {
    audioId: snapshot.audioId,
    startedAt: snapshot.startedAt,
    listenedSeconds: snapshot.listenedSeconds,
    completed: snapshot.completed,
    clientEventId: snapshot.clientEventId,
  };
  if (snapshot.source) {
    event.source = snapshot.source;
  }
  if (snapshot.playlistId != null && Number.isInteger(snapshot.playlistId) && snapshot.playlistId > 0) {
    event.playlistId = snapshot.playlistId;
  }
  return event;
}

export function playEventBody(event: PlayEvent): PlayEvent {
  return snapshotToPlayEvent(event) ?? event;
}

export function loadPlayQueue(storage: QueueStorage): PlayEvent[] {
  const raw = storage.read();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(normalizeStoredEvent).filter((event): event is PlayEvent => event != null);
  } catch {
    return [];
  }
}

export function savePlayQueue(storage: QueueStorage, events: readonly PlayEvent[]): void {
  storage.write(JSON.stringify(events));
}

/**
 * Inserts or replaces by `clientEventId`. A 0-second event is ignored.
 * Replacing keeps a single row so a retry cannot duplicate the listen.
 */
export function enqueuePlayEvent(storage: QueueStorage, event: PlayEvent): PlayEvent[] {
  const stored = snapshotToPlayEvent(event);
  const current = loadPlayQueue(storage);
  if (!stored) {
    return current;
  }
  const index = current.findIndex((item) => item.clientEventId === stored.clientEventId);
  const next = current.slice();
  if (index >= 0) {
    next[index] = stored;
  } else {
    next.push(stored);
  }
  savePlayQueue(storage, next);
  return next;
}

export function playPostDisposition(status: number): PlayPostDisposition {
  if (status === 200 || status === 201) {
    return 'done';
  }
  if (status === 0 || status === 408 || status === 429 || status >= 500) {
    return 'retry';
  }
  return 'drop';
}

/**
 * Posts each queued event. Success and permanent client errors leave the queue.
 * A failed delivery stays, in order, for the next attempt.
 */
export async function flushPlayQueue(
  storage: QueueStorage,
  deliver: (event: PlayEvent) => Promise<PlayPostDisposition>,
): Promise<{ delivered: string[]; pending: PlayEvent[] }> {
  const pending = loadPlayQueue(storage);
  const delivered: string[] = [];
  const kept: PlayEvent[] = [];
  for (const event of pending) {
    try {
      const result = await deliver(event);
      if (result === 'retry') {
        kept.push(event);
      } else {
        delivered.push(event.clientEventId);
      }
    } catch {
      kept.push(event);
    }
  }
  savePlayQueue(storage, kept);
  return { delivered, pending: kept };
}

export interface KeepaliveTransport {
  fetch(url: string, body: string): boolean;
  beacon(url: string, body: string): boolean;
}

/** Prefer `fetch` with `keepalive`. Fall back to `sendBeacon` when fetch cannot run. */
export function postPlayKeepalive(url: string, body: string, transport?: KeepaliveTransport): boolean {
  const client = transport ?? browserKeepalive();
  try {
    if (client.fetch(url, body)) {
      return true;
    }
  } catch {
    // Try the beacon below.
  }
  try {
    return client.beacon(url, body);
  } catch {
    return false;
  }
}

export function sendQueuedPlays(url: string, events: readonly PlayEvent[], post: (url: string, body: string) => boolean): number {
  let sent = 0;
  for (const event of events) {
    if (event.listenedSeconds <= 0) {
      continue;
    }
    if (post(url, JSON.stringify(playEventBody(event)))) {
      sent += 1;
    }
  }
  return sent;
}

function browserKeepalive(): KeepaliveTransport {
  return {
    fetch(url, body) {
      if (typeof fetch !== 'function') {
        return false;
      }
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit',
      }).catch(() => undefined);
      return true;
    },
    beacon(url, body) {
      if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
        return false;
      }
      return navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    },
  };
}

function normalizeStoredEvent(raw: unknown): PlayEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const audioId = record['audioId'];
  const listenedSeconds = record['listenedSeconds'];
  const startedAt = record['startedAt'];
  const clientEventId = record['clientEventId'];
  if (typeof audioId !== 'number' || !Number.isInteger(audioId) || audioId <= 0) {
    return null;
  }
  if (typeof listenedSeconds !== 'number' || !Number.isFinite(listenedSeconds) || listenedSeconds <= 0) {
    return null;
  }
  if (typeof startedAt !== 'string' || !startedAt || typeof clientEventId !== 'string' || !clientEventId) {
    return null;
  }
  const event: PlayEvent = {
    audioId,
    startedAt,
    listenedSeconds: Math.round(listenedSeconds),
    completed: record['completed'] === true,
    clientEventId,
  };
  const source = record['source'];
  if (isPlaySource(source)) {
    event.source = source;
  }
  const playlistId = record['playlistId'];
  if (typeof playlistId === 'number' && Number.isInteger(playlistId) && playlistId > 0) {
    event.playlistId = playlistId;
  }
  return event;
}

function isPlaySource(value: unknown): value is PlaySource {
  return (
    value === 'library' ||
    value === 'search' ||
    value === 'playlist' ||
    value === 'artist' ||
    value === 'shuffle' ||
    value === 'other'
  );
}
