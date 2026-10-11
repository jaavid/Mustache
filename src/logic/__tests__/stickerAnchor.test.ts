import { describe, expect, it } from 'vitest';
import { toHeroAnchor, fromHeroAnchor } from '../stickerAnchor';
describe('WYSIWYG attachment tracks the exact impact pixel', () => {
  it('preserves an off-center shot, not the mouth coordinate', () => {
    const hero = { x: 400, y: 300, rotation: 0, scaleX: 0.64, scaleY: 0.64 };
    const aim = { x: 423, y: 236 };
    const local = toHeroAnchor(hero, aim);
    const actual = fromHeroAnchor(hero, local);
    expect(actual.x).toBeCloseTo(aim.x);
    expect(actual.y).toBeCloseTo(aim.y);
    expect(actual.x).not.toBe(hero.x);
  });
  it('tracks subsequent hero rotation/translation while maintaining local cheek offset', () => {
    const oldHero = { x: 300, y: 300, rotation: 0.17, scaleX: 0.82, scaleY: 0.82 };
    const aim = { x: 313, y: 250 };
    const local = toHeroAnchor(oldHero, aim);
    expect(fromHeroAnchor(oldHero, local).x).toBeCloseTo(aim.x);
    expect(fromHeroAnchor(oldHero, local).y).toBeCloseTo(aim.y);
    const moved = { ...oldHero, x: 320, y: 305, rotation: -0.34 };
    const next = fromHeroAnchor(moved, local);
    expect(next.x).not.toBeCloseTo(aim.x);
    expect(fromHeroAnchor(moved, toHeroAnchor(moved, next)).x).toBeCloseTo(next.x);
  });
});
