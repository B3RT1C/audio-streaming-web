export type RepeatMode = 'off' | 'all' | 'one';
export type AdvanceReason = 'ended' | 'next' | 'previous';

export const RESTART_AFTER_SECONDS = 3;

export interface QueueCursor {
  index: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Queue indices in play order. Used only while shuffle is on. */
  order: number[];
  cursor: number;
}

export interface AdvanceResult {
  cursor: QueueCursor;
  restart: boolean;
  stopped: boolean;
}

export function createQueueCursor(length: number, startIndex: number): QueueCursor {
  if (length <= 0) {
    return { index: -1, shuffle: false, repeat: 'off', order: [], cursor: 0 };
  }
  const index = clampIndex(startIndex, length);
  return { index, shuffle: false, repeat: 'off', order: [], cursor: 0 };
}

export function replaceQueue(
  length: number,
  startIndex: number,
  previous: Pick<QueueCursor, 'shuffle' | 'repeat'>,
  random: () => number = Math.random,
): QueueCursor {
  const cursor = createQueueCursor(length, startIndex);
  cursor.repeat = previous.repeat;
  if (previous.shuffle && length > 0) {
    return {
      ...cursor,
      shuffle: true,
      order: shuffledIndices(length, cursor.index, random),
      cursor: 0,
    };
  }
  return cursor;
}

export function withShuffle(
  cursor: QueueCursor,
  length: number,
  enabled: boolean,
  random: () => number = Math.random,
): QueueCursor {
  if (!enabled || length <= 0 || cursor.index < 0) {
    return { ...cursor, shuffle: false, order: [], cursor: 0 };
  }
  return {
    ...cursor,
    shuffle: true,
    order: shuffledIndices(length, cursor.index, random),
    cursor: 0,
  };
}

export function nextRepeatMode(mode: RepeatMode): RepeatMode {
  if (mode === 'off') {
    return 'all';
  }
  if (mode === 'all') {
    return 'one';
  }
  return 'off';
}

export function advance(
  cursor: QueueCursor,
  length: number,
  reason: AdvanceReason,
  currentTime: number,
  random: () => number = Math.random,
): AdvanceResult {
  if (length <= 0 || cursor.index < 0) {
    return { cursor, restart: false, stopped: true };
  }

  if (reason === 'previous' && currentTime > RESTART_AFTER_SECONDS) {
    return { cursor, restart: true, stopped: false };
  }

  if (reason === 'ended' && cursor.repeat === 'one') {
    return { cursor, restart: true, stopped: false };
  }

  return step(cursor, length, reason === 'previous' ? -1 : 1, random);
}

export function shuffledIndices(
  length: number,
  startIndex: number,
  random: () => number = Math.random,
): number[] {
  const rest: number[] = [];
  for (let index = 0; index < length; index += 1) {
    if (index !== startIndex) {
      rest.push(index);
    }
  }
  for (let index = rest.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = rest[index];
    rest[index] = rest[swap];
    rest[swap] = current;
  }
  if (startIndex >= 0 && startIndex < length) {
    return [startIndex, ...rest];
  }
  return rest;
}

function step(
  cursor: QueueCursor,
  length: number,
  direction: -1 | 1,
  random: () => number,
): AdvanceResult {
  if (cursor.shuffle) {
    const order =
      cursor.order.length === length ? cursor.order : shuffledIndices(length, cursor.index, random);
    let position = order.indexOf(cursor.index);
    if (position < 0) {
      position = 0;
    }
    const target = position + direction;
    if (target >= 0 && target < order.length) {
      return {
        cursor: { ...cursor, order, cursor: target, index: order[target] },
        restart: false,
        stopped: false,
      };
    }
    if (cursor.repeat === 'all' && length > 0) {
      const reshuffled = shuffledIndices(length, -1, random);
      const index = direction > 0 ? 0 : reshuffled.length - 1;
      return {
        cursor: { ...cursor, order: reshuffled, cursor: index, index: reshuffled[index] },
        restart: false,
        stopped: false,
      };
    }
    if (direction < 0) {
      return { cursor: { ...cursor, order, cursor: position }, restart: true, stopped: false };
    }
    return { cursor: { ...cursor, order, cursor: position }, restart: false, stopped: true };
  }

  const target = cursor.index + direction;
  if (target >= 0 && target < length) {
    return { cursor: { ...cursor, index: target }, restart: false, stopped: false };
  }
  if (cursor.repeat === 'all' && length > 0) {
    const index = direction > 0 ? 0 : length - 1;
    return { cursor: { ...cursor, index }, restart: false, stopped: false };
  }
  if (direction < 0) {
    return { cursor, restart: true, stopped: false };
  }
  return { cursor, restart: false, stopped: true };
}

function clampIndex(startIndex: number, length: number): number {
  if (!Number.isFinite(startIndex) || startIndex < 0) {
    return 0;
  }
  return Math.min(startIndex, length - 1);
}
