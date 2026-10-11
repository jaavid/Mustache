import { describe, expect, it } from 'vitest';
import { achievementsForRound, missionsForRound, scoreShareText } from '../progression';
import { emptyStats, summarizeRound } from '../roundStats';
describe('local mission and achievement progression', () => {
  it('shows three measurable replay goals', () => {
    const summary = summarizeRound(
      { ...emptyStats, shots: 5, hits: 4, perfect: 3, good: 1, misses: 1, maxCombo: 4 },
      600,
    );
    const missions = missionsForRound(summary, 600);
    expect(missions).toHaveLength(3);
    expect(missions.every((m) => m.done)).toBe(true);
  });
  it('unlocks achievements only when actual round performance qualifies', () => {
    expect(achievementsForRound(summarizeRound(emptyStats, 0), 0)).toHaveLength(0);
    const s = summarizeRound(
      { ...emptyStats, shots: 5, hits: 5, perfect: 4, good: 1, misses: 0, maxCombo: 5 },
      1300,
    );
    expect(achievementsForRound(s, 1300).map((a) => a.id)).toEqual([
      'first',
      'sharpshooter',
      'combo-king',
      'high-roller',
      'flawless',
    ]);
  });
  it('includes transparent offline score attribution in share text', () => {
    const summary = summarizeRound(emptyStats, 600);
    const shared = scoreShareText(600, summary);
    expect(shared).toContain('600');
    expect(shared).toContain('not independently verified');
    expect(shared).toContain('mustache.alexa.ir');
  });
});
