import { describe, expect, it } from 'vitest';
import { RAMIN_VARIANTS, chooseRaminVariant, chooseSpawnEvent, variantReward } from '../variety';

describe('Ramin variation and fair event rules', () => {
  it('uses distinct weighted cosmetic outcomes', () => {
    const cases: Array<[number, string]> = [
      [0, 'normal'],
      [0.549, 'normal'],
      [0.55, 'sunglasses'],
      [0.729, 'sunglasses'],
      [0.73, 'round'],
      [0.849, 'round'],
      [0.85, 'headband'],
      [0.949, 'headband'],
      [0.95, 'gold'],
      [0.999, 'gold'],
    ];
    for (const [roll, expected] of cases) expect(chooseRaminVariant(roll)).toBe(expected);
    expect(new Set(RAMIN_VARIANTS).size).toBe(5);
  });

  it('reserves event spawns for the middle of a round', () => {
    expect(chooseSpawnEvent(3, 42, 0.01, 'normal')).toBe('normal');
    expect(chooseSpawnEvent(12, 33, 0.01, 'normal')).toBe('normal');
    expect(chooseSpawnEvent(20, 25, 0.01, 'normal')).toBe('fake-out');
    expect(chooseSpawnEvent(20, 25, 0.1, 'normal')).toBe('double');
    expect(chooseSpawnEvent(20, 25, 0.8, 'normal')).toBe('normal');
    expect(chooseSpawnEvent(34, 11, 0.22, 'normal')).toBe('double');
    expect(chooseSpawnEvent(40, 5, 0.01, 'normal')).toBe('normal');
  });

  it('prevents successive special events of the same type', () => {
    expect(chooseSpawnEvent(20, 25, 0.02, 'fake-out')).toBe('normal');
    expect(chooseSpawnEvent(20, 25, 0.12, 'double')).toBe('normal');
  });

  it('adds bonuses for successful impacts only', () => {
    expect(variantReward('gold', 'perfect')).toEqual({ bonus: 50, label: 'GOLD +50' });
    expect(variantReward('gold', 'good').bonus).toBe(50);
    expect(variantReward('gold', 'miss').bonus).toBe(0);
    expect(variantReward('sunglasses', 'perfect').bonus).toBe(25);
    expect(variantReward('sunglasses', 'good').bonus).toBe(0);
    expect(variantReward('round', 'perfect').bonus).toBe(0);
    expect(variantReward('normal', 'perfect').bonus).toBe(0);
  });
});
