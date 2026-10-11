import { describe, expect, it } from 'vitest';
import { normalizeTouchDistance } from '../touch';
import { evaluateAim } from '../scoring';
describe('portrait touch aiming', () => {
  const lip = { x: 270, y: 480 };
  it('keeps a forgiving but visible ellipse for a direct finger tap', () => {
    expect(evaluateAim({ x: lip.x + 18, y: lip.y }, lip, 0, true, true).grade).toBe('perfect');
    expect(evaluateAim({ x: lip.x + 32, y: lip.y }, lip, 0, true, true).grade).toBe('good');
  });
  it('does not magnetize cheeks or distant taps to the lip', () => {
    expect(evaluateAim({ x: lip.x + 70, y: lip.y }, lip, 0, true, true).grade).toBe('miss');
    expect(evaluateAim({ x: lip.x, y: lip.y - 40 }, lip, 0, true, true).grade).toBe('miss');
  });
  it('keeps the previous helper available while new gameplay uses evaluateAim', () => {
    expect(normalizeTouchDistance(20)).toBe(16);
    expect(evaluateAim(lip, lip, 0, false, true).points).toBe(0);
  });
});
