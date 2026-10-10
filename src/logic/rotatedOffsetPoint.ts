/**
 * Applies a sprite-local offset in world coordinates.
 * Phaser uses screen coordinates (positive Y is down) and clockwise rotation.
 */
export function rotatedOffsetPoint(
  centerX: number,
  centerY: number,
  offsetX: number,
  offsetY: number,
  rotation: number,
): { x: number; y: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: centerX + offsetX * cos - offsetY * sin,
    y: centerY + offsetX * sin + offsetY * cos,
  };
}
