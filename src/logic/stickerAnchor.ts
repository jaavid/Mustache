import type { AimPoint } from './scoring';
/** Relative sticker coordinates expressed in hero sprite-frame units so the
 * original AIM point stays attached to the same cheek/lip pixel while the
 * character rotates, reacts and returns behind a tree.
 */
export type HeroTransform = Readonly<{
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}>;
export type StickerAnchor = Readonly<{ x: number; y: number }>;
export function toHeroAnchor(hero: HeroTransform, aim: AimPoint): StickerAnchor {
  const dx = aim.x - hero.x,
    dy = aim.y - hero.y,
    c = Math.cos(hero.rotation),
    s = Math.sin(hero.rotation);
  return { x: (dx * c + dy * s) / hero.scaleX, y: (dy * c - dx * s) / hero.scaleY };
}
export function fromHeroAnchor(hero: HeroTransform, anchor: StickerAnchor): AimPoint {
  const x = anchor.x * hero.scaleX,
    y = anchor.y * hero.scaleY,
    c = Math.cos(hero.rotation),
    s = Math.sin(hero.rotation);
  return { x: hero.x + x * c - y * s, y: hero.y + x * s + y * c };
}
