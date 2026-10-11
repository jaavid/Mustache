import { describe, expect, it } from 'vitest';
import { impactCharacter, impactPlan } from '../impactPersonality';
describe('visual-only mustache style impact', () => {
  it('gives three recognizable impact patterns, independent of points', () => {
    expect([0, 1, 2].map(impactCharacter)).toEqual(['snap', 'twirl', 'heavy']);
    const plans = [0, 1, 2].map((s) => impactPlan(s, 'perfect'));
    expect(plans[0].startScale).toBeLessThan(plans[2].startScale);
    expect(plans[1].peakScale).toBeGreaterThan(plans[0].peakScale);
    expect(plans.every((p) => p.durationMs > 0 && p.durationMs < 250)).toBe(true);
  });
  it('uses gentler pops for GOOD', () => {
    for (const style of [0, 1, 2])
      expect(impactPlan(style, 'good').peakScale).toBeLessThan(
        impactPlan(style, 'perfect').peakScale,
      );
  });

});

import { treeAtImpact } from '../impactPersonality';
describe('tree sticker contact is collision-driven', () => {
  const desktop = { centers: [193, 473, 748], centerY: 300, halfWidth: 30, top: 143, bottom: 486 };
  const mobile = { centers: [78, 270, 462], centerY: 552, halfWidth: 23, top: 395, bottom: 738 };
  it('sticks only to actual bark coordinates, no nearest-tree magnetism', () => {
    expect(treeAtImpact({ x: 193, y: 300 }, desktop)).toBe(193);
    expect(treeAtImpact({ x: 220, y: 450 }, desktop)).toBe(193);
    expect(treeAtImpact({ x: 248, y: 300 }, desktop)).toBeNull();
    expect(treeAtImpact({ x: 480, y: 127 }, desktop)).toBeNull();
    expect(treeAtImpact({ x: NaN, y: 300 }, desktop)).toBeNull();
    expect(treeAtImpact({ x: 270, y: 550 }, mobile)).toBe(270);
    expect(treeAtImpact({ x: 305, y: 550 }, mobile)).toBeNull();
  });
});
