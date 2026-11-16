import { advance, createQueueCursor, nextRepeatMode, replaceQueue, withShuffle } from './playback-queue';

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
