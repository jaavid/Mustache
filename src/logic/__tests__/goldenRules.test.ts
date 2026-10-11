import { describe, expect, it } from 'vitest';
import {
  goldenHit, goldenPosition, GOLDEN_SPAWN_MS, GOLDEN_FLIGHT_MS, GOLDEN_REQUIRED,
  GOLDEN_PERFECT_BONUS,
} from '../../../shared/goldenRules.js';

describe('deterministic golden collectible', () => {
  it('has five scheduled flights and a single three-pickup charge', () => {
    expect(GOLDEN_SPAWN_MS).toEqual([7000, 14000, 21000, 28000, 35000]);
    expect(GOLDEN_REQUIRED).toBe(3);
    expect(GOLDEN_PERFECT_BONUS).toBe(350);
  });
  it.each([false, true])('uses exact position and touch geometry, portrait=%s', portrait => {
    for (let index = 0; index < GOLDEN_SPAWN_MS.length; index++) {
      const t = GOLDEN_SPAWN_MS[index] + GOLDEN_FLIGHT_MS / 2;
      const point = goldenPosition(index, t, portrait);
      expect(point).not.toBeNull();
      expect(goldenHit(index, t, point!, portrait)).toBe(true);
      expect(goldenHit(index, t, { x: point!.x + 100, y: point!.y }, portrait)).toBe(false);
      expect(goldenPosition(index, GOLDEN_SPAWN_MS[index] - 1, portrait)).toBeNull();
      expect(goldenPosition(index, GOLDEN_SPAWN_MS[index] + GOLDEN_FLIGHT_MS + 1, portrait)).toBeNull();
    }
  });
});
