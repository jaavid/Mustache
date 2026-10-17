/** Display registration in the shared 96×220 tree-local coordinate system.
 * These two CC0 source sprites include their own trunk and roots. We retain the
 * complete natural silhouette; no procedural beige rectangle or replacement
 * bark is needed. Both layers render from this same transform.
 */
export type ForestSpecies = 'oak' | 'cedar';
export const TREE_CANVAS_SIZE = { width: 96, height: 220 } as const;
export const TREE_SOURCE_REGISTRATION = {
  oak: { sourceWidth: 70, sourceHeight: 98, x: 4, y: 23, width: 88, height: 192 },
  cedar: { sourceWidth: 74, sourceHeight: 128, x: 7, y: 4, width: 82, height: 211 },
} as const;

/** Front occlusion is a copy of the *original sprite*, clipped to its lower
 * trunk/low foliage: sprites still disappear behind trees when entering, but
 * no separately drawn, mismatched trunk can ever show up on top of the art.
 * Bark stays static while only the rear canopy sways in Phaser.
 */
export const TREE_TRUNK_OCCLUSION = {
  oak: [
    [24, 108], [72, 108], [70, 142], [63, 168], [65, 195],
    [79, 218], [17, 218], [31, 195], [34, 168], [27, 142],
  ],
  cedar: [
    [29, 102], [67, 102], [60, 146], [59, 189], [66, 218],
    [28, 218], [37, 189], [36, 146],
  ],
} as const;
