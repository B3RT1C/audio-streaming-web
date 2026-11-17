import { layoutRows, visibleRange } from './virtual-window';

describe('visibleRange', () => {
  it('returns a small slice of a 7000 row library', () => {
    const { spans, total } = layoutRows(Array.from({ length: 7000 }, () => 72));
    expect(total).toBe(7000 * 72);
    const range = visibleRange(spans, 0, 800, 4);
    expect(range.start).toBe(0);
    expect(range.end).toBeLessThan(30);
    expect(range.end).toBeGreaterThan(8);

    const scrolled = visibleRange(spans, 50_000, 50_800, 4);
    expect(scrolled.start).toBeGreaterThan(600);
    expect(scrolled.end - scrolled.start).toBeLessThan(30);
    expect(scrolled.end).toBeLessThanOrEqual(7000);
  });
});
