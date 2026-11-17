export interface RowSpan {
  top: number;
  height: number;
}

export function layoutRows(heights: readonly number[]): { spans: RowSpan[]; total: number } {
  const spans: RowSpan[] = new Array(heights.length);
  let top = 0;
  for (let index = 0; index < heights.length; index += 1) {
    const height = heights[index] ?? 0;
    spans[index] = { top, height };
    top += height;
  }
  return { spans, total: top };
}

/**
 * Indexes whose rows intersect [viewTop, viewBottom], plus a few extra
 * above and below so a fast scroll does not flash empty space.
 */
export function visibleRange(
  spans: readonly RowSpan[],
  viewTop: number,
  viewBottom: number,
  overscan = 4,
): { start: number; end: number } {
  if (spans.length === 0) {
    return { start: 0, end: 0 };
  }
  const target = Math.max(0, viewTop);
  let lo = 0;
  let hi = spans.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const span = spans[mid];
    if (span.top + span.height <= target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const start = Math.max(0, lo - overscan);
  let end = lo;
  const bottom = Math.max(target, viewBottom);
  while (end < spans.length && spans[end].top < bottom) {
    end += 1;
  }
  end = Math.min(spans.length, end + overscan);
  return { start, end: Math.max(start, end) };
}
