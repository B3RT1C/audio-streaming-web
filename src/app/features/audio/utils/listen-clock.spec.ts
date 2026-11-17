import {
  changeListen,
  closeListen,
  createListenMachine,
  ListenMachine,
  ListenOpen,
  peekListen,
  sampleListen,
  seekListen,
} from './listen-clock';

function open(id: number, clientEventId = `id-${id}`): ListenOpen {
  return {
    audioId: id,
    startedAt: '2026-11-17T10:00:00.000Z',
    clientEventId,
    origin: { source: 'library' },
  };
}

function playTo(state: ListenMachine, target: number): ListenMachine {
  const start = state.current?.clock.position ?? 0;
  let next = sampleListen(state, start, true);
  const steps = Math.round(target - start);
  for (let step = 1; step <= steps; step += 1) {
    next = sampleListen(next, start + step, true);
  }
  return next;
}

describe('listen clock', () => {
  it('does not add time while paused, then continues from the paused position', () => {
    let state = changeListen(createListenMachine(), open(1), false).state;
    state = playTo(state, 5);
    state = sampleListen(state, 15, false);
    state = playTo(state, 19);

    const snapshot = closeListen(state, false).snapshot;
    expect(snapshot?.listenedSeconds).toBe(9);
    expect(snapshot?.completed).toBe(false);
    expect(snapshot?.audioId).toBe(1);
  });

  it('does not add the span skipped by a forward or backward seek', () => {
    let state = changeListen(createListenMachine(), open(4, 'seek-1'), false).state;
    state = playTo(state, 8);
    state = seekListen(state, 40);
    state = playTo(state, 42);
    state = seekListen(state, 3);
    state = playTo(state, 6);

    const snapshot = closeListen(state, false).snapshot;
    expect(snapshot?.listenedSeconds).toBe(13);
    expect(snapshot?.clientEventId).toBe('seek-1');
  });

  it('closes a finished song as completed and keeps the last step', () => {
    let state = changeListen(createListenMachine(), open(7), false).state;
    state = playTo(state, 30);

    const result = closeListen(state, true);
    expect(result.snapshot).toEqual({
      audioId: 7,
      startedAt: '2026-11-17T10:00:00.000Z',
      listenedSeconds: 30,
      completed: true,
      source: 'library',
      clientEventId: 'id-7',
    });
    expect(result.state.current).toBeNull();
  });

  it('emits the previous listen when the track changes and starts the next one at zero', () => {
    let state = changeListen(
      createListenMachine(),
      { ...open(1, 'first'), origin: { source: 'playlist', playlistId: 9 } },
      false,
    ).state;
    state = playTo(state, 12);

    const changed = changeListen(state, { ...open(2, 'second'), origin: { source: 'playlist', playlistId: 9 } }, false);
    expect(changed.snapshot).toMatchObject({
      audioId: 1,
      listenedSeconds: 12,
      completed: false,
      source: 'playlist',
      playlistId: 9,
      clientEventId: 'first',
    });
    expect(changed.state.current?.audioId).toBe(2);
    expect(changed.state.current?.clock.listenedSeconds).toBe(0);

    const ended = closeListen(playTo(changed.state, 4), true);
    expect(ended.snapshot).toMatchObject({
      audioId: 2,
      listenedSeconds: 4,
      completed: true,
      clientEventId: 'second',
    });
  });

  it('drops a listen that rounds to zero seconds and keeps the same id while it is open', () => {
    let state = changeListen(createListenMachine(), open(3, 'same'), false).state;
    state = sampleListen(state, 0.4, true);
    expect(peekListen(state, false)).toBeNull();
    expect(closeListen(state, false).snapshot).toBeNull();

    state = changeListen(createListenMachine(), open(3, 'same'), false).state;
    state = sampleListen(state, 1.4, true);
    const first = peekListen(state, false);
    state = sampleListen(state, 2.6, true);
    const second = peekListen(state, false);
    expect(first?.clientEventId).toBe('same');
    expect(second?.clientEventId).toBe('same');
    expect(second?.listenedSeconds).toBeGreaterThan(first?.listenedSeconds ?? 0);
  });
});
