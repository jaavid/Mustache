import { describe, expect, it } from 'vitest';
import { nextSlot, popPlan, projectileMs, projectilePoint } from '../gameplay';

describe('arcade gameplay motion', () => {
  it('never repeats a valid previous spawn', () => {
    for (let old = 0; old < 3; old++) for (let i = 0; i < 100; i++) {
      const next = nextSlot(old, 3, i / 100);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(3);
      expect(next).not.toBe(old);
    }
    expect(nextSlot(0, 1, .7)).toBe(0);
  });

  it('offers three behaviors with guaranteed minimum exposure', () => {
    const plans = [.1, .5, .9].map(value => popPlan(45, value));
    expect(plans.map(plan => plan.behavior)).toEqual(['peek', 'hop', 'dash']);
    for (const plan of plans) {
      expect(plan.visibleMs).toBeGreaterThanOrEqual(990);
      expect(plan.entryMs).toBeGreaterThan(0);
      expect(plan.pauseMs).toBeGreaterThan(0);
    }
  });

  it('gets faster without collapsing hit windows', () => {
    for (const roll of [.1, .5, .9]) {
      expect(popPlan(45, roll).visibleMs).toBeLessThan(popPlan(0, roll).visibleMs);
      expect(popPlan(500, roll).visibleMs).toBeGreaterThanOrEqual(990);
    }
  });

  it('flies between exact endpoints on a curved arc', () => {
    const a = { x: 270, y: 772 }, b = { x: 135, y: 490 };
    expect(projectilePoint(a, b, 0, 55)).toEqual(a);
    expect(projectilePoint(a, b, 1, 55)).toEqual(b);
    const mid = projectilePoint(a, b, .5, 55);
    expect(mid.y).toBeLessThan((a.y + b.y) / 2);
    expect(mid.x).toBeCloseTo((a.x + b.x) / 2);
  });

  it('bounds flight duration independent of screen size', () => {
    expect(projectileMs({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(200);
    expect(projectileMs({ x: 0, y: 0 }, { x: 10000, y: 0 })).toBe(390);
  });
});
