import { describe, expect, it } from 'vitest';
import {
  DESKTOP_TREE_CENTERS,
  MOBILE_TREE_CENTERS,
  FOREST_TREE_SPECIES,
} from '../treeGeometry';

describe('licensed forest asset layout', () => {
  it('uses only cedar and oak across the three stable collision lanes', () => {
    expect(FOREST_TREE_SPECIES).toEqual(['cedar', 'oak', 'cedar']);
    expect(new Set(FOREST_TREE_SPECIES)).toEqual(new Set(['cedar', 'oak']));
    expect(FOREST_TREE_SPECIES).toHaveLength(DESKTOP_TREE_CENTERS.length);
    expect(FOREST_TREE_SPECIES).toHaveLength(MOBILE_TREE_CENTERS.length);
  });
});
