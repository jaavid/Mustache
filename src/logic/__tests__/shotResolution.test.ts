import { describe, expect, it } from 'vitest';
import { emptyStats } from '../roundStats';
import { resolveRoundShot } from '../shotResolution';

const base = {
  lip: { x: 270, y: 350 },
  score: 500,
  combo: 2,
  stats: emptyStats,
  variant: 'normal' as const,
  portrait: false,
};

describe('shared shot transaction', () => {
  it('preserves the same perfect/combo math on both layouts', () => {
    for (const portrait of [false, true]) {
      const shot = resolveRoundShot({ ...base, aim: base.lip, portrait });
      expect(shot.result.grade).toBe('perfect');
      expect(shot.score).toBe(620);
      expect(shot.combo).toBe(3);
      expect(shot.stats.shots).toBe(1);
      expect(shot.stats.perfect).toBe(1);
      expect(base.stats.shots).toBe(0);
    }
  });

  it('keeps gold and sunglasses reward rules intact', () => {
    expect(resolveRoundShot({ ...base, aim: base.lip, variant: 'gold' }).gained).toBe(170);
    expect(resolveRoundShot({ ...base, aim: base.lip, variant: 'sunglasses' }).gained).toBe(145);
  });

  it('pays +350 only for a single charged PERFECT', () => {
    expect(resolveRoundShot({ ...base, aim: base.lip, goldenShot: true })).toMatchObject({
      gained: 470,
      goldenPerfect: true,
    });
    expect(resolveRoundShot({ ...base, aim: { x: 295, y: 350 }, goldenShot: true })).toMatchObject({
      gained: 70,
      goldenPerfect: false,
    });
    expect(resolveRoundShot({ ...base, aim: { x: 500, y: 350 }, goldenShot: true })).toMatchObject({
      gained: 0,
      goldenPerfect: false,
    });
  });

  it('counts a miss once and resets combo without granting points', () => {
    const shot = resolveRoundShot({ ...base, aim: { x: 500, y: 350 } });
    expect(shot).toMatchObject({ score: 500, combo: 0, gained: 0 });
    expect(shot.stats).toMatchObject({ shots: 1, misses: 1, hits: 0 });
  });

  it('respects separate touch hit-zone tolerances', () => {
    const aim = { x: base.lip.x + 36, y: base.lip.y };
    expect(resolveRoundShot({ ...base, aim, portrait: false }).result.grade).toBe('miss');
    expect(resolveRoundShot({ ...base, aim, portrait: true }).result.grade).toBe('good');
  });
});
