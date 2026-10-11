/** Framework-independent gameplay timings and shot path geometry.
 * All distances are Phaser logical pixels, never raw CSS viewport pixels.
 */
export type Point = { x: number; y: number };
export type Side = -1 | 1;
export type Behavior = 'peek' | 'hop' | 'dash';

export interface PopPlan {
  behavior: Behavior;
  side: Side;
  entryMs: number;
  visibleMs: number;
  exitMs: number;
  pauseMs: number;
  shift: number;
  lift: number;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Uniform choice among slots excluding the previous, avoiding immediate repetition. */
export function nextSlot(previous: number, count: number, random: number): number {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('count must be positive');
  if (count === 1) return 0;
  const draw = Math.floor(clamp(random, 0, 0.99999999) * (count - 1));
  return previous < 0 || previous >= count
    ? Math.floor(clamp(random, 0, 0.99999999) * count)
    : draw >= previous
      ? draw + 1
      : draw;
}

/** Three legible motion patterns and a gradual pacing increase over a 45-second round. */
export function popPlan(elapsedSeconds: number, random: number): PopPlan {
  const progress = clamp(elapsedSeconds / 45, 0, 1);
  const roll = clamp(random, 0, 0.99999999);
  const behavior: Behavior = roll < 0.36 ? 'peek' : roll < 0.72 ? 'hop' : 'dash';
  const side: Side = Math.floor(roll * 997) % 2 ? -1 : 1;
  const base = behavior === 'peek' ? 1640 : behavior === 'hop' ? 1460 : 1320;
  return {
    behavior,
    side,
    entryMs: behavior === 'peek' ? 360 : behavior === 'hop' ? 285 : 215,
    visibleMs: Math.round(Math.max(990, base - progress * 280)),
    exitMs: behavior === 'dash' ? 160 : 230,
    pauseMs: behavior === 'dash' ? 175 : 245,
    shift: behavior === 'peek' ? 46 : behavior === 'hop' ? 70 : 94,
    lift: behavior === 'hop' ? 92 : behavior === 'peek' ? 35 : 54,
  };
}

/** Quadratic Bezier flight with an upward bend; returns exact endpoints at t=0/1. */
export function projectilePoint(start: Point, end: Point, t: number, arcHeight: number): Point {
  const p = clamp(t, 0, 1),
    inv = 1 - p;
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2 - Math.max(0, arcHeight);
  return {
    x: inv * inv * start.x + 2 * inv * p * midX + p * p * end.x,
    y: inv * inv * start.y + 2 * inv * p * midY + p * p * end.y,
  };
}

export function projectileMs(start: Point, end: Point): number {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  return Math.round(clamp(165 + distance * 0.31, 200, 390));
}
