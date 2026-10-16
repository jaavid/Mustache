import { describe, expect, it } from 'vitest';
import { characterDisplaySize, characterRenderScale, DESIGN_FRAME } from '../characterGeometry';
import { CHARACTER_IDS } from '../../game/characterChoice';

describe('shared visual character geometry', () => {
  it('normalizes Mammad source frames to the same design height at every scene scale', () => {
    for (const scale of [0.57, 0.6, 0.64, 0.82, 0.82 * 1.06]) {
      const ramin = characterDisplaySize('ramin', scale);
      const mammad = characterDisplaySize('mammad', scale);
      const borhan = characterDisplaySize('borhan', scale);
      expect(mammad.height).toBeCloseTo(ramin.height, 8);
      expect(mammad.width).toBeCloseTo(ramin.width, 1);
      expect(borhan).toEqual(ramin);
      expect(mammad.height).toBeCloseTo(DESIGN_FRAME.height * scale, 8);
    }
  });

  it('provides native sprite scales for tween targets instead of raw design scales', () => {
    expect(characterRenderScale('ramin', 0.64)).toBe(0.64);
    expect(characterRenderScale('borhan', 0.82)).toBe(0.82);
    expect(characterRenderScale('mammad', 0.64)).toBeCloseTo((0.64 * 362) / 150, 8);
    expect(characterRenderScale('mammad', 0.82)).toBeCloseTo((0.82 * 362) / 150, 8);
    expect(characterRenderScale('mammad', 0.64)).toBeGreaterThan(1.5);
  });

  it('covers exactly the selectable heroes and rejects invalid scale values', () => {
    expect(CHARACTER_IDS).toEqual(['ramin', 'borhan', 'mammad']);
    for (const id of CHARACTER_IDS) {
      expect(characterDisplaySize(id, 1).height).toBeCloseTo(362, 8);
    }
    for (const bad of [0, -1, Infinity, NaN]) {
      expect(() => characterRenderScale('mammad', bad)).toThrow(RangeError);
    }
  });
});
