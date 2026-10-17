import { describe, expect, it } from 'vitest';
import {
  TREE_CANVAS_SIZE,
  TREE_SOURCE_REGISTRATION,
  TREE_TRUNK_OCCLUSION,
} from '../forestArtLayout';

describe('CC0 forest trunks and layer registration', () => {
  it('uses only native source trees with a shared base position', () => {
    expect(Object.keys(TREE_SOURCE_REGISTRATION)).toEqual(['oak', 'cedar']);
    for (const species of ['oak', 'cedar'] as const) {
      const art = TREE_SOURCE_REGISTRATION[species];
      expect(art.x + art.width / 2).toBe(TREE_CANVAS_SIZE.width / 2);
      expect(art.y + art.height).toBe(TREE_CANVAS_SIZE.height - 5);
      expect(art.width).toBeLessThanOrEqual(TREE_CANVAS_SIZE.width);
    }
  });

  it('clips the same source sprite to lower tree pixels instead of adding bark columns', () => {
    for (const species of ['oak', 'cedar'] as const) {
      const points = TREE_TRUNK_OCCLUSION[species];
      expect(points.length).toBeGreaterThanOrEqual(8);
      const left = Math.min(...points.map((p) => p[0]));
      const right = Math.max(...points.map((p) => p[0]));
      const top = Math.min(...points.map((p) => p[1]));
      const bottom = Math.max(...points.map((p) => p[1]));
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(TREE_CANVAS_SIZE.width);
      expect(top).toBeGreaterThan(90);
      expect(bottom).toBeLessThanOrEqual(TREE_CANVAS_SIZE.height);
      expect(left).toBeLessThan(48);
      expect(right).toBeGreaterThan(48);
    }
  });
});
