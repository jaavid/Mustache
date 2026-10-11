import { describe, expect, it } from 'vitest';
import {
  roundPhase,
  tunePopPlan,
  comboMilestone,
  PHASE_PROFILES,
  phaseCaption,
} from '../arcadePhases';
import { popPlan } from '../gameplay';

describe('noticeably distinct but fair arcade stages', () => {
  it('switches at exactly 15s and 30s', () => {
    expect(roundPhase(0)).toBe('WARMUP');
    expect(roundPhase(14.999)).toBe('WARMUP');
    expect(roundPhase(15)).toBe('GROOVE');
    expect(roundPhase(29.99)).toBe('GROOVE');
    expect(roundPhase(30)).toBe('FINALE');
    expect(phaseCaption('FINALE')).toContain('3/3');
  });
  it('has increasingly fast sound tempo and bounded hit windows', () => {
    const [a, b, c] = [PHASE_PROFILES.WARMUP, PHASE_PROFILES.GROOVE, PHASE_PROFILES.FINALE];
    expect(a.tempoBpm).toBeLessThan(b.tempoBpm);
    expect(b.tempoBpm).toBeLessThan(c.tempoBpm);
    expect(a.minVisibleMs).toBeGreaterThan(b.maxVisibleMs);
    expect(b.minVisibleMs).toBeGreaterThan(c.maxVisibleMs);
    expect(c.minVisibleMs).toBeGreaterThanOrEqual(1050);
    expect(c.minEntryMs).toBeGreaterThanOrEqual(200);
  });
  it('tunes the same behavior to substantially different exposure durations', () => {
    for (const roll of [0.1, 0.5, 0.9]) {
      const base = popPlan(20, roll);
      const warm = tunePopPlan(base, 3);
      const groove = tunePopPlan(base, 22);
      const finale = tunePopPlan(base, 37);
      expect(warm.visibleMs - groove.visibleMs).toBeGreaterThanOrEqual(270);
      expect(groove.visibleMs - finale.visibleMs).toBeGreaterThanOrEqual(70);
      expect(finale.visibleMs).toBeGreaterThanOrEqual(1050);
      expect(warm.pauseMs).toBeGreaterThan(groove.pauseMs);
      expect(groove.pauseMs).toBeGreaterThan(finale.pauseMs);
      expect(base.visibleMs).toBe(popPlan(20, roll).visibleMs);
    }
  });
  it('celebrates meaningful combo milestones only', () => {
    expect(comboMilestone(2)).toBeNull();
    expect(comboMilestone(3)).toContain('STREAK');
    expect(comboMilestone(5)).toContain('FIRE');
    expect(comboMilestone(8)).toContain('UNSTOPPABLE');
    expect(comboMilestone(10)).toContain('MASTER');
    expect(comboMilestone(11)).toBeNull();
  });
});
