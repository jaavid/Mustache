import { describe, expect, it } from 'vitest';
import {
  emptyStats,
  recordShot,
  accuracyPercent,
  calculateMedal,
  summarizeRound,
} from '../roundStats';
describe('impact-time round stats and medals', () => {
  it('handles a no-shot round', () => {
    expect(summarizeRound(emptyStats, 0)).toMatchObject({
      shots: 0,
      hits: 0,
      accuracy: 0,
      medal: 'NONE',
    });
  });
  it('tracks shots, perfects and max combo from real impact grades', () => {
    let stats = recordShot(emptyStats, 'perfect', 1);
    stats = recordShot(stats, 'good', 2);
    stats = recordShot(stats, 'miss', 0);
    stats = recordShot(stats, 'perfect', 1);
    expect(stats).toEqual({ shots: 4, hits: 3, perfect: 2, good: 1, misses: 1, maxCombo: 2 });
    expect(accuracyPercent(stats)).toBe(75);
    expect(emptyStats.shots).toBe(0); // immutable source
  });
  it('uses documented score-and-accuracy medal requirements', () => {
    expect(calculateMedal(1800, 75)).toBe('GOLD');
    expect(calculateMedal(1800, 45)).toBe('BRONZE');
    expect(calculateMedal(1100, 55)).toBe('SILVER');
    expect(calculateMedal(410, 0)).toBe('BRONZE');
    expect(calculateMedal(100, 100)).toBe('NONE');
  });
});
