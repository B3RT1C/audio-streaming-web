export interface ChartPoint {
  period: string;
  plays: number;
  listenedSeconds: number;
}

export interface ChartDot {
  x: number;
  y: number;
  point: ChartPoint;
}

export interface TimelineChart {
  width: number;
  height: number;
  line: string;
  area: string;
  dots: ChartDot[];
  labels: { x: number; text: string; anchor: 'start' | 'middle' | 'end' }[];
  baseline: number;
}

const WIDTH = 320;
const HEIGHT = 168;

/** Builds a line chart in a fixed viewBox. The SVG scales with CSS; no chart library. */
export function buildTimelineChart(points: readonly ChartPoint[]): TimelineChart | null {
  if (points.length === 0 || points.every((point) => point.listenedSeconds <= 0 && point.plays <= 0)) {
    return null;
  }
  const padLeft = 8;
  const padRight = 8;
  const padTop = 16;
  const padBottom = 24;
  const innerWidth = WIDTH - padLeft - padRight;
  const innerHeight = HEIGHT - padTop - padBottom;
  const max = Math.max(1, ...points.map((point) => point.listenedSeconds));
  const baseline = padTop + innerHeight;
  const dots: ChartDot[] = points.map((point, index) => {
    const x = points.length === 1 ? padLeft + innerWidth / 2 : padLeft + (innerWidth * index) / (points.length - 1);
    const y = baseline - (Math.max(0, point.listenedSeconds) / max) * innerHeight;
    return { x: round(x), y: round(y), point };
  });
  const line = dots.map((dot, index) => `${index === 0 ? 'M' : 'L'}${dot.x} ${dot.y}`).join(' ');
  const area = `${line} L${dots[dots.length - 1].x} ${baseline} L${dots[0].x} ${baseline} Z`;
  return {
    width: WIDTH,
    height: HEIGHT,
    line,
    area,
    dots: dots.length <= 16 ? dots : [],
    labels: axisLabels(dots),
    baseline,
  };
}

function axisLabels(dots: ChartDot[]): TimelineChart['labels'] {
  if (dots.length === 0) {
    return [];
  }
  const picks = dots.length === 1 ? [0] : [0, Math.floor((dots.length - 1) / 2), dots.length - 1];
  const unique = [...new Set(picks)];
  return unique.map((index, position) => {
    const anchor = position === 0 ? 'start' : position === unique.length - 1 ? 'end' : 'middle';
    return { x: dots[index].x, text: dots[index].point.period, anchor };
  });
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
