import { describe, expect, it } from 'vitest';
import { normalizeTouchDistance } from '../touch';
import { evaluateShot } from '../scoring';

describe('portrait touch aiming', () => {
  it('awards a perfect hit for a nearby tap', () => {
    expect(evaluateShot(normalizeTouchDistance(23), 0, true).grade).toBe('perfect');
  });
  it('keeps far-away taps as misses', () => {
    expect(evaluateShot(normalizeTouchDistance(70), 0, true).grade).toBe('miss');
  });
  it('does not score while Ramin is hidden', () => {
    expect(evaluateShot(normalizeTouchDistance(0), 0, false).points).toBe(0);
  });
});
