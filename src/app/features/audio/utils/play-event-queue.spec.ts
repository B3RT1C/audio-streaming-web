import {
  enqueuePlayEvent,
  flushPlayQueue,
  loadPlayQueue,
  memoryQueueStorage,
  PlayEvent,
  playPostDisposition,
  postPlayKeepalive,
  sendQueuedPlays,
} from './play-event-queue';

function event(overrides: Partial<PlayEvent> = {}): PlayEvent {
  return {
    audioId: 4,
    startedAt: '2026-11-17T10:00:00.000Z',
    listenedSeconds: 12,
    completed: false,
    source: 'library',
    clientEventId: 'evt-1',
    ...overrides,
  };
}

describe('play event queue', () => {
  it('does not store a zero-second event', () => {
    const storage = memoryQueueStorage();
    expect(enqueuePlayEvent(storage, event({ listenedSeconds: 0 }))).toEqual([]);
    expect(loadPlayQueue(storage)).toEqual([]);
  });

  it('replaces an event with the same clientEventId instead of duplicating it', () => {
    const storage = memoryQueueStorage();
    enqueuePlayEvent(storage, event({ listenedSeconds: 8 }));
    const queued = enqueuePlayEvent(storage, event({ listenedSeconds: 21, completed: true }));
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ listenedSeconds: 21, completed: true, clientEventId: 'evt-1' });
  });

  it('keeps a failed delivery and removes it after a later success', async () => {
    const storage = memoryQueueStorage();
    enqueuePlayEvent(storage, event({ clientEventId: 'a', audioId: 1 }));
    enqueuePlayEvent(storage, event({ clientEventId: 'b', audioId: 2 }));

    const attempts: string[] = [];
    const first = await flushPlayQueue(storage, async (item) => {
      attempts.push(item.clientEventId);
      if (item.clientEventId === 'a') {
        throw new Error('offline');
      }
      return 'done';
    });
    expect(attempts).toEqual(['a', 'b']);
    expect(first.pending.map((item) => item.clientEventId)).toEqual(['a']);
    expect(loadPlayQueue(storage).map((item) => item.clientEventId)).toEqual(['a']);

    const second = await flushPlayQueue(storage, async () => 'done');
    expect(second.pending).toEqual([]);
    expect(loadPlayQueue(storage)).toEqual([]);
  });

  it('retries transport failures and drops a rejected client error', async () => {
    const storage = memoryQueueStorage();
    enqueuePlayEvent(storage, event({ clientEventId: 'keep' }));
    enqueuePlayEvent(storage, event({ clientEventId: 'bad', audioId: 8 }));

    await flushPlayQueue(storage, async (item) => (item.clientEventId === 'bad' ? 'drop' : 'retry'));
    expect(loadPlayQueue(storage).map((item) => item.clientEventId)).toEqual(['keep']);
    expect(playPostDisposition(0)).toBe('retry');
    expect(playPostDisposition(503)).toBe('retry');
    expect(playPostDisposition(201)).toBe('done');
    expect(playPostDisposition(400)).toBe('drop');
  });

  it('ignores a broken queue and still sends the valid events with fetch keepalive', () => {
    const storage = memoryQueueStorage();
    storage.write('{');
    expect(loadPlayQueue(storage)).toEqual([]);

    storage.write(JSON.stringify([event(), { listenedSeconds: 0 }, 'nope']));
    expect(loadPlayQueue(storage)).toHaveLength(1);

    const bodies: string[] = [];
    const sent = sendQueuedPlays('http://localhost:8080/plays', loadPlayQueue(storage), (_url, body) => {
      bodies.push(body);
      return true;
    });
    expect(sent).toBe(1);
    expect(JSON.parse(bodies[0])).toMatchObject({ audioId: 4, listenedSeconds: 12, clientEventId: 'evt-1' });

    const calls: string[] = [];
    expect(
      postPlayKeepalive('http://localhost:8080/plays', bodies[0], {
        fetch: (url) => {
          calls.push(`fetch:${url}`);
          return true;
        },
        beacon: () => {
          calls.push('beacon');
          return true;
        },
      }),
    ).toBe(true);
    expect(calls).toEqual(['fetch:http://localhost:8080/plays']);

    expect(
      postPlayKeepalive('http://localhost:8080/plays', bodies[0], {
        fetch: () => false,
        beacon: (url) => {
          calls.push(`beacon:${url}`);
          return true;
        },
      }),
    ).toBe(true);
    expect(calls).toContain('beacon:http://localhost:8080/plays');
  });
});
