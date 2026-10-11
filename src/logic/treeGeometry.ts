import type { Side } from './gameplay';

/** Tree centers are also the local X axis of both independently drawn tree layers. */
export const DESKTOP_TREE_CENTERS = [193, 473, 748] as const;
export const MOBILE_TREE_CENTERS = [78, 270, 462] as const;
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
