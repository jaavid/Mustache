import { describe, expect, it } from 'vitest';
import { goldRushShotBonus } from '../../../shared/modeRules.js';
import { resolveRoundShot } from '../shotResolution';
import { emptyStats } from '../roundStats';

describe('Gold Rush client/server rules', () => {
  it('adds 50 on perfect and 150 after every three consecutive perfects', () => {
    expect(goldRushShotBonus('perfect', 1)).toBe(50);
    expect(goldRushShotBonus('perfect', 2)).toBe(50);
    expect(goldRushShotBonus('perfect', 3)).toBe(200);
    expect(goldRushShotBonus('perfect', 6)).toBe(200);
    expect(goldRushShotBonus('good', 3)).toBe(0);
    expect(goldRushShotBonus('miss', 3)).toBe(0);
  });

  it('does not change the original classic scoring path', () => {
    const base = {
      aim: { x: 300, y: 250 },
      lip: { x: 300, y: 250 },
      score: 0,
      combo: 0,
      stats: emptyStats,
      variant: 'normal' as const,
      portrait: false,
    };
    const classic = resolveRoundShot(base);
    const gold = resolveRoundShot({ ...base, mode: 'goldRush', perfectStreakBefore: 2 });
    expect(classic.gained).toBe(100);
    expect(gold.gained).toBe(300);
    expect(gold.perfectStreak).toBe(3);
    expect(
      resolveRoundShot({ ...base, mode: 'goldRush', aim: { x: 0, y: 0 }, perfectStreakBefore: 2 })
        .perfectStreak,
    ).toBe(0);
  });
});
