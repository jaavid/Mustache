import type { CharacterId } from '../game/characterChoice';

/** Native dimensions of the artist-supplied frames; all gameplay layout uses 210×362. */
export const CHARACTER_FRAME_SIZES = {
  ramin: { width: 210, height: 362 },
  borhan: { width: 210, height: 362 },
  mammad: { width: 87, height: 150 },
} as const;

export const DESIGN_FRAME = { width: 210, height: 362 } as const;

/** Phaser scales sprites in source pixels. Mammad's 87×150 source needs a
 * 362/150 scale factor, including in entry and reaction tween targets.
 * Uniform scaling preserves the original source aspect ratio.
 */
export function characterRenderScale(character: CharacterId, designScale: number): number {
  if (!Number.isFinite(designScale) || designScale <= 0) {
    throw new RangeError('Invalid character design scale');
  }
  return designScale * (DESIGN_FRAME.height / CHARACTER_FRAME_SIZES[character].height);
}

export function characterDisplaySize(character: CharacterId, designScale: number) {
  const scale = characterRenderScale(character, designScale);
  const { width, height } = CHARACTER_FRAME_SIZES[character];
  return { width: width * scale, height: height * scale };
}
