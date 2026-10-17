import { describe, expect, it } from 'vitest';
import { treeAtImpact } from '../impactPersonality';
import {
  DESKTOP_TREE_CENTERS,
  MOBILE_TREE_CENTERS,
  DESKTOP_PEEK_DISTANCE,
  MOBILE_PEEK_DISTANCE,
  chooseSpawnSide,
  peekPosition,
  DESKTOP_TRUNK_BOUNDS,
  MOBILE_TRUNK_BOUNDS,
} from '../treeGeometry';
describe('tree spawn lanes and occlusion geometry', () => {
  it('uses inward-facing exits at the outer trees', () => {
    for (const preferred of [-1, 1] as const) {
      expect(chooseSpawnSide(0, 3, preferred)).toBe(1);
      expect(chooseSpawnSide(2, 3, preferred)).toBe(-1);
      expect(chooseSpawnSide(1, 3, preferred)).toBe(preferred);
    }
  });
  it('keeps all playable centers away from mobile side clipping', () => {
    const [left, mid, right] = MOBILE_TREE_CENTERS;
    expect(peekPosition(left, 1, MOBILE_PEEK_DISTANCE)).toBeGreaterThan(130);
    expect(peekPosition(right, -1, MOBILE_PEEK_DISTANCE)).toBeLessThan(410);
    expect(mid - left).toBeGreaterThan(150);
    expect(right - mid).toBeGreaterThan(150);
  });
  it('never places an active face inside an occluding trunk', () => {
    for (const centers of [DESKTOP_TREE_CENTERS, MOBILE_TREE_CENTERS]) {
      for (let index = 0; index < centers.length; index++) {
        const side = chooseSpawnSide(index, centers.length, 1);
        const distance =
          centers === DESKTOP_TREE_CENTERS ? DESKTOP_PEEK_DISTANCE : MOBILE_PEEK_DISTANCE;
        const x = peekPosition(centers[index], side, distance);
        expect(Math.abs(x - centers[index])).toBeGreaterThan(75);
      }
    }
  });
  it('rejects invalid spawn positions', () => {
    expect(() => chooseSpawnSide(3, 3, 1)).toThrow(RangeError);
    expect(() => chooseSpawnSide(-1, 3, 1)).toThrow(RangeError);
  });
});

describe('art and hit geometry stay aligned after the forest upgrade', () => {
  it('keeps every collision lane anchored to the stationary bark center', () => {
    for (const bounds of [DESKTOP_TRUNK_BOUNDS, MOBILE_TRUNK_BOUNDS]) {
      expect(bounds.centers).toHaveLength(3);
      for (const x of bounds.centers) {
        expect(treeAtImpact({ x, y: bounds.top }, bounds)).toBe(x);
        expect(treeAtImpact({ x, y: bounds.bottom }, bounds)).toBe(x);
        expect(treeAtImpact({ x, y: bounds.top - 1 }, bounds)).toBe(null);
        expect(treeAtImpact({ x, y: bounds.bottom + 1 }, bounds)).toBe(null);
      }
    }
  });

  it('tracks the visible 96x220 bark hit area in both layouts', () => {
    for (const [bounds, displayWidth, displayHeight] of [
      [DESKTOP_TRUNK_BOUNDS, 190, 430],
      [MOBILE_TRUNK_BOUNDS, 146, 430],
    ] as const) {
      // Visible bark spans native source x=37..62, y=94..208.
      const left = ((48 - 33) * displayWidth) / 96;
      const top = bounds.centerY - displayHeight / 2 + (94 * displayHeight) / 220;
      const bottom = bounds.centerY - displayHeight / 2 + (208 * displayHeight) / 220;
      expect(Math.abs(bounds.halfWidth - left)).toBeLessThan(2);
      expect(Math.abs(bounds.top - top)).toBeLessThan(3);
      expect(Math.abs(bounds.bottom - bottom)).toBeLessThan(6);
    }
  });
});
