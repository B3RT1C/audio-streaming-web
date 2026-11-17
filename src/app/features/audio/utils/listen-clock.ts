/**
 * Counts seconds the audio actually advanced while playing.
 * A forward seek or a jump while paused moves the cursor and adds nothing.
 * `timeupdate` steps are well under {@link MAX_LISTEN_STEP_SECONDS}; larger gaps are seeks.
 */

export const MAX_LISTEN_STEP_SECONDS = 3;

export type PlaySource = 'library' | 'search' | 'playlist' | 'artist' | 'shuffle' | 'other';

export interface PlayOrigin {
  source: PlaySource;
  playlistId?: number;
}

export interface ListenClock {
  listenedSeconds: number;
  /** Last observed playback position, in seconds. */
  position: number;
  playing: boolean;
}

export interface ListenOpen {
  audioId: number;
  startedAt: string;
  clientEventId: string;
  origin: PlayOrigin;
}

export interface OpenListen extends ListenOpen {
  clock: ListenClock;
}

export interface ListenMachine {
  current: OpenListen | null;
}

/** What a finished (or snapshotted) listen is worth sending. Zero seconds are omitted. */
export interface ListenSnapshot {
  audioId: number;
  startedAt: string;
  listenedSeconds: number;
  completed: boolean;
  source?: PlaySource;
  playlistId?: number;
  clientEventId: string;
}

export interface ListenChange {
  state: ListenMachine;
  snapshot: ListenSnapshot | null;
}

export function createListenClock(): ListenClock {
  return { listenedSeconds: 0, position: 0, playing: false };
}

export function createListenMachine(): ListenMachine {
  return { current: null };
}

export function roundListenedSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.round(seconds);
}

/**
 * Records one playback sample.
 * While paused, the position may jump (a seek) and the listened total stays put.
 * While playing, only a small forward step counts. A seek in either direction does not.
 */
export function listenSample(
  clock: ListenClock,
  positionSeconds: number,
  playing: boolean,
  maxStep = MAX_LISTEN_STEP_SECONDS,
): ListenClock {
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
    return { ...clock, playing };
  }
  if (!playing) {
    return { ...clock, playing: false, position: positionSeconds };
  }
  const delta = positionSeconds - clock.position;
  if (delta > 0 && delta <= maxStep) {
    return {
      listenedSeconds: clock.listenedSeconds + delta,
      position: positionSeconds,
      playing: true,
    };
  }
  return { ...clock, playing: true, position: positionSeconds };
}

/** Moves the cursor to a seek target. The skipped span is never added. */
export function listenSeek(clock: ListenClock, positionSeconds: number): ListenClock {
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
    return clock;
  }
  return { ...clock, position: positionSeconds };
}

export function sampleListen(state: ListenMachine, positionSeconds: number, playing: boolean): ListenMachine {
  if (!state.current) {
    return state;
  }
  return {
    current: {
      ...state.current,
      clock: listenSample(state.current.clock, positionSeconds, playing),
    },
  };
}

export function seekListen(state: ListenMachine, positionSeconds: number): ListenMachine {
  if (!state.current) {
    return state;
  }
  return {
    current: { ...state.current, clock: listenSeek(state.current.clock, positionSeconds) },
  };
}

/** Reads the current listen without closing it. Same `clientEventId` for a later send. */
export function peekListen(state: ListenMachine, completed: boolean): ListenSnapshot | null {
  const current = state.current;
  if (!current) {
    return null;
  }
  const listenedSeconds = roundListenedSeconds(current.clock.listenedSeconds);
  if (listenedSeconds <= 0) {
    return null;
  }
  const snapshot: ListenSnapshot = {
    audioId: current.audioId,
    startedAt: current.startedAt,
    listenedSeconds,
    completed,
    clientEventId: current.clientEventId,
  };
  if (current.origin.source) {
    snapshot.source = current.origin.source;
  }
  if (current.origin.playlistId != null) {
    snapshot.playlistId = current.origin.playlistId;
  }
  return snapshot;
}

/** Ends the open listen. A 0-second listen produces no snapshot. */
export function closeListen(state: ListenMachine, completed: boolean): ListenChange {
  if (!state.current) {
    return { state, snapshot: null };
  }
  return { state: { current: null }, snapshot: peekListen(state, completed) };
}

/**
 * Ends the open listen and starts another.
 * Passing the same audio id still starts a new listen (the song ended and restarted, or the user picked it again).
 */
export function changeListen(state: ListenMachine, next: ListenOpen | null, completed: boolean): ListenChange {
  const closed = closeListen(state, completed);
  if (!next) {
    return closed;
  }
  return {
    state: {
      current: {
        audioId: next.audioId,
        startedAt: next.startedAt,
        clientEventId: next.clientEventId,
        origin: { ...next.origin },
        clock: createListenClock(),
      },
    },
    snapshot: closed.snapshot,
  };
}
