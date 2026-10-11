import type { Grade } from './scoring';
export type ImpactCharacter = 'snap' | 'twirl' | 'heavy';
export function impactCharacter(style: number): ImpactCharacter {
  return style === 1 ? 'twirl' : style === 2 ? 'heavy' : 'snap';
}
export type ImpactPlan = Readonly<{
  startScale: number;
  peakScale: number;
  durationMs: number;
  rotation: number;
}>;
/** Deterministic motion presets; never change score or aim windows based on mustache style. */
export function impactPlan(style: number, grade: Grade): ImpactPlan {
  const character = impactCharacter(style);
  const perfect = grade === 'perfect';
  if (character === 'twirl')
    return {
      startScale: 0.42,
      peakScale: perfect ? 1.38 : 1.2,
      durationMs: perfect ? 215 : 180,
      rotation: -0.13,
    };
  if (character === 'heavy')
    return {
      startScale: 0.82,
      peakScale: perfect ? 1.12 : 1.07,
      durationMs: perfect ? 165 : 142,
      rotation: 0.07,
    };
  return {
    startScale: 0.38,
    peakScale: perfect ? 1.28 : 1.14,
    durationMs: perfect ? 170 : 145,
    rotation: 0,
  };
}
/** Actual tree bark occupies a narrow part of the tree sprite.
 * A missed shot only sticks when its AIM point intersects the drawn trunk,
 * not merely because a tree exists nearby.
 */
export type TrunkBounds = Readonly<{
  centers: readonly number[];
  centerY: number;
  halfWidth: number;
  top: number;
  bottom: number;
}>;
export function treeAtImpact(aim: { x: number; y: number }, bounds: TrunkBounds): number | null {
  if (
    !Number.isFinite(aim.x) ||
    !Number.isFinite(aim.y) ||
    aim.y < bounds.top ||
    aim.y > bounds.bottom
  )
    return null;
  for (const center of bounds.centers)
    if (Math.abs(aim.x - center) <= bounds.halfWidth) return center;
  return null;
}
