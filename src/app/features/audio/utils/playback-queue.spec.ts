import {
  advance,
  createQueueCursor,
  mulberry32,
  nextRepeatMode,
  QueueCursor,
  replaceQueue,
  withShuffle,
} from './playback-queue';

describe('playback queue', () => {
  it('stops at the end unless repeat is all', () => {
    const cursor = createQueueCursor(2, 1);
    expect(advance(cursor, 2, 'ended', 0).stopped).toBe(true);

    const looping = { ...cursor, repeat: 'all' as const };
    expect(advance(looping, 2, 'next', 0).cursor.index).toBe(0);
  });

  it('restarts the same track when repeat is one and the song ends', () => {
    const cursor = { ...createQueueCursor(3, 1), repeat: 'one' as const };
    const ended = advance(cursor, 3, 'ended', 40);
    expect(ended.restart).toBe(true);
    expect(ended.cursor.index).toBe(1);

    const skipped = advance(cursor, 3, 'next', 40);
    expect(skipped.cursor.index).toBe(2);
  });

  it('restarts the current track when previous is pressed after a few seconds', () => {
    const cursor = createQueueCursor(3, 1);
    expect(advance(cursor, 3, 'previous', 8).restart).toBe(true);
    expect(advance(cursor, 3, 'previous', 1).cursor.index).toBe(0);
  });

  it('plays a shuffled order that starts at the current track and visits each index once', () => {
    const random = sequence([0, 0, 0]);
    const cursor = withShuffle(createQueueCursor(4, 2), 4, true, random);
    expect(cursor.order[0]).toBe(2);
    expect(new Set(cursor.order).size).toBe(4);

    const next = advance(cursor, 4, 'next', 0, random);
    expect(next.cursor.index).toBe(cursor.order[1]);
  });

  it('does not repeat a track until the shuffled queue is exhausted', () => {
    const random = mulberry32(7);
    const again = mulberry32(7);
    const cursor = withShuffle(createQueueCursor(6, 1), 6, true, random);
    expect(withShuffle(createQueueCursor(6, 1), 6, true, again).order).toEqual(cursor.order);

    const seen = new Set<number>();
    let current = cursor;
    for (let step = 0; step < 6; step += 1) {
      expect(seen.has(current.index)).toBe(false);
      seen.add(current.index);
      if (step < 5) {
        const next = advance(current, 6, 'next', 0, () => 0);
        expect(next.stopped).toBe(false);
        current = next.cursor;
      }
    }
    expect(seen.size).toBe(6);
    expect(advance(current, 6, 'ended', 30, () => 0).stopped).toBe(true);
  });

  it('keeps shuffle beside repeat one, and starts a new cycle only after the queue ends', () => {
    const shuffled = { ...withShuffle(createQueueCursor(4, 1), 4, true, sequence([0, 0, 0])), repeat: 'one' as const };
    const ended = advance(shuffled, 4, 'ended', 20, () => 0);
    expect(ended.restart).toBe(true);
    expect(ended.cursor.index).toBe(shuffled.index);
    expect(ended.cursor.shuffle).toBe(true);

    const looping: QueueCursor = { ...shuffled, repeat: 'all' };
    let current: QueueCursor = looping;
    const firstPass: number[] = [];
    for (let step = 0; step < 4; step += 1) {
      firstPass.push(current.index);
      current = advance(current, 4, 'next', 0, sequence([0, 0, 0])).cursor;
    }
    expect(new Set(firstPass).size).toBe(4);
    expect(current.index).not.toBe(firstPass[firstPass.length - 1]);
    expect(new Set(current.order).size).toBe(4);
  });

  it('keeps repeat when the queue is replaced', () => {
    const previous = { ...createQueueCursor(1, 0), repeat: 'all' as const };
    const replaced = replaceQueue(3, 2, previous);
    expect(replaced.index).toBe(2);
    expect(replaced.repeat).toBe('all');
    expect(nextRepeatMode('all')).toBe('one');
    expect(nextRepeatMode('one')).toBe('off');
  });
});

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0;
}
