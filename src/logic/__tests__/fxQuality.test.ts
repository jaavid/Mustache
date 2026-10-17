import { describe, expect, it } from 'vitest';
import { FX_BUDGETS, leafBudget, selectFxQuality } from '../fxQuality';

describe('budgeted Phaser 4 particle presentation', () => {
  it('prioritizes accessibility, then hardware preference', () => {
    expect(selectFxQuality(true, false)).toBe('reduced');
    expect(selectFxQuality(true, true)).toBe('reduced');
    expect(selectFxQuality(false, true)).toBe('low');
    expect(selectFxQuality(false, false)).toBe('full');
  });

  it('caps temporary particles without affecting projectile movement', () => {
    expect(FX_BUDGETS.full.starsPerfect).toBeGreaterThan(FX_BUDGETS.low.starsPerfect);
    expect(FX_BUDGETS.low.starsGood).toBeGreaterThan(0);
    expect(FX_BUDGETS.reduced.starsPerfect).toBe(0);
    expect(FX_BUDGETS.reduced.fallingLeaves).toBe(false);
    expect(FX_BUDGETS.reduced.projectileTrailStep).toBeGreaterThan(1);
    expect(leafBudget(9, 'full')).toBe(9);
    expect(leafBudget(9, 'low')).toBe(5);
    expect(leafBudget(9, 'reduced')).toBe(0);
  });
});
