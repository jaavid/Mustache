import { describe, expect, it } from 'vitest';
import { evaluateShot } from '../scoring';

describe('evaluateShot', () => {
  it('awards accurate mustache placements', () => {
    expect(evaluateShot(0, 0, true)).toMatchObject({ grade: 'perfect', points: 100, combo: 1 });
    expect(evaluateShot(15, 2, true)).toMatchObject({ grade: 'perfect', points: 120, combo: 3 });
  });
  it('uses a smaller good-hit window', () => {
    expect(evaluateShot(29, 0, true)).toMatchObject({ grade: 'good', points: 50, combo: 1 });
    expect(evaluateShot(43, 0, true).grade).toBe('good');
  });
  it('rejects misses and hidden targets, resets combo', () => {
    expect(evaluateShot(44, 6, true)).toMatchObject({ grade: 'miss', points: 0, combo: 0 });
    expect(evaluateShot(0, 6, false)).toMatchObject({ grade: 'miss', points: 0, combo: 0 });
    expect(evaluateShot(Number.NaN, 6, true).grade).toBe('miss');
  });
  it('caps combo bonus', () => {
    expect(evaluateShot(0, 99, true).points).toBe(150);
  });
});
