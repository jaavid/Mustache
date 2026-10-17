import { describe, expect, it } from 'vitest';
import { PHASE_TOAST, PHASE_TOAST_MS, shouldAccentPerfectStreak } from '../visualPolish';

describe('Phaser 4 visual feedback does not change score timing', () => {
  it('keeps stage announcements short and clear of the portrait face', () => {
    expect(PHASE_TOAST_MS).toBeLessThanOrEqual(800);
    expect(PHASE_TOAST.portrait.width).toBeLessThan(380);
    expect(PHASE_TOAST.portrait.y).toBeLessThan(360);
    expect(PHASE_TOAST.landscape.width).toBeLessThan(500);
  });
  it('shows the rare localized accent only for perfect streaks', () => {
    expect(shouldAccentPerfectStreak(true, 5)).toBe(true);
    expect(shouldAccentPerfectStreak(true, 7)).toBe(true);
    expect(shouldAccentPerfectStreak(true, 4)).toBe(false);
    expect(shouldAccentPerfectStreak(false, 9)).toBe(false);
    expect(shouldAccentPerfectStreak(true, NaN)).toBe(false);
  });
});
