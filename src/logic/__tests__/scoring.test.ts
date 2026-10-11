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

import { evaluateAim, AIM_ZONES, inLipEllipse } from '../scoring';
describe('lip-shaped hit detection with honest landing coordinates', () => {
  const lip = { x: 275, y: 340 };
  it('requires precision in two axes rather than proximity anywhere on the face', () => {
    expect(evaluateAim(lip, lip, 0, true).grade).toBe('perfect');
    expect(evaluateAim({ x: lip.x + 12, y: lip.y + 7 }, lip, 0, true).grade).toBe('perfect');
    expect(evaluateAim({ x: lip.x + 26, y: lip.y }, lip, 0, true).grade).toBe('good');
    expect(evaluateAim({ x: lip.x, y: lip.y + 18 }, lip, 0, true).grade).toBe('good');
    expect(evaluateAim({ x: lip.x + 34, y: lip.y }, lip, 3, true).grade).toBe('miss');
    expect(evaluateAim({ x: lip.x, y: lip.y - 23 }, lip, 3, true).grade).toBe('miss');
  });
  it('reports the actual distance and caps the combo bonus as before', () => {
    expect(evaluateAim({ x: 290, y: 340 }, lip, 10, true)).toMatchObject({
      grade: 'perfect',
      distance: 15,
      points: 150,
      combo: 11,
    });
    expect(evaluateAim({ x: 290, y: 340 }, lip, 10, false)).toMatchObject({
      grade: 'miss',
      points: 0,
      combo: 0,
    });
    expect(evaluateAim({ x: NaN, y: 340 }, lip, 0, true).grade).toBe('miss');
  });
  it('preserves a slightly larger, still elliptical mobile tap zone', () => {
    expect(AIM_ZONES.mobile.goodX).toBeGreaterThan(AIM_ZONES.desktop.goodX);
    expect(evaluateAim({ x: lip.x + 36, y: lip.y }, lip, 0, true, true).grade).toBe('good');
    expect(evaluateAim({ x: lip.x + 36, y: lip.y }, lip, 0, true, false).grade).toBe('miss');
    expect(evaluateAim({ x: lip.x, y: lip.y + 27 }, lip, 0, true, true).grade).toBe('miss');
    expect(inLipEllipse({ x: lip.x + 40, y: lip.y }, lip, 17, 12)).toBe(false);
  });
});
