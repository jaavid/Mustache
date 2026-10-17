import type { Side } from './gameplay';

/** Tree centers are also the local X axis of both independently drawn tree layers. */
export const DESKTOP_TREE_CENTERS = [193, 473, 748] as const;
export const MOBILE_TREE_CENTERS = [78, 270, 462] as const;
/** Two CC0 silhouettes over three spawn lanes: cedar - oak - cedar. */
export const FOREST_TREE_SPECIES = ['cedar', 'oak', 'cedar'] as const;
export const DESKTOP_PEEK_DISTANCE = 96;
export const MOBILE_PEEK_DISTANCE = 96;

/** Edge trees always peek inwards. Middle trees may choose either side. */
export function chooseSpawnSide(index: number, count: number, preferred: Side): Side {
  if (!Number.isInteger(index) || !Number.isInteger(count) || index < 0 || index >= count)
    throw new RangeError('Invalid tree index');
  if (index === 0) return 1;
  if (index === count - 1) return -1;
  return preferred;
}
/**
 * Keeps the Ramin torso centered beside the trunk so the face clears the
 * front bark while the emergence begins directly behind the same bark axis.
 */
export function peekPosition(trunkCenter: number, side: Side, distance: number): number {
  return trunkCenter + side * distance;
}

/** Bark stays stationary while only the rear crown sways.
 * Bounds retain the pre-art-pass hit geometry and match the baked trunks.
 */
export const DESKTOP_TRUNK_BOUNDS = {
  centers: DESKTOP_TREE_CENTERS,
  centerY: 300,
  halfWidth: 30,
  top: 143,
  bottom: 486,
} as const;
export const MOBILE_TRUNK_BOUNDS = {
  centers: MOBILE_TREE_CENTERS,
  centerY: 552,
  halfWidth: 23,
  top: 395,
  bottom: 738,
} as const;
