/** A slightly wider effective hit radius for touch screens.
 * The point values, combo progression, and desktop thresholds remain unchanged.
 */
export function normalizeTouchDistance(distance: number): number {
  return distance * 0.8;
}
