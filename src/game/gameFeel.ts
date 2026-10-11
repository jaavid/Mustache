import Phaser from 'phaser';
import { type Point, type PopPlan, projectileMs, projectilePoint } from '../logic/gameplay';

/** Peeking around a tree is primarily a sideways move, hopping also rises vertically.
 * The character remains behind the tree artwork until reaching the target pose.
 */
export function enterFromTree(
  scene: Phaser.Scene,
  hero: Phaser.GameObjects.Sprite,
  at: Point,
  baseScale: number,
  plan: PopPlan,
  ready: () => void,
): void {
  scene.tweens.killTweensOf(hero);
  hero.setPosition(at.x - plan.side * plan.shift, at.y + plan.lift)
    .setAlpha(.18).setScale(baseScale * .87)
    .setAngle(-plan.side * (plan.behavior === 'dash' ? 15 : 9))
    .setVisible(true);
  scene.tweens.add({
    targets: hero,
    x: at.x, y: at.y, alpha: 1, angle: plan.side * 2,
    scaleX: baseScale, scaleY: baseScale,
    duration: plan.entryMs,
    ease: plan.behavior === 'hop' ? 'Back.easeOut' : 'Cubic.easeOut',
    onComplete: () => ready(),
  });
}

/** Sinks/backs away toward the same trunk. Call only after shooting or timeout. */
export function exitBehindTree(
  scene: Phaser.Scene,
  hero: Phaser.GameObjects.Sprite,
  plan: PopPlan,
  finished: () => void,
): void {
  scene.tweens.killTweensOf(hero);
  scene.tweens.add({
    targets: hero,
    x: hero.x - plan.side * plan.shift,
    y: hero.y + plan.lift,
    alpha: 0,
    angle: -plan.side * 10,
    duration: plan.exitMs,
    ease: 'Quad.easeIn',
    onComplete: () => { hero.setVisible(false); finished(); },
  });
}

/** Tween the projectile along a bezier path, with a small timed spark trail.
 * A shot is resolved only when this callback fires, never at pointer-down.
 */
export function launchMustache(
  scene: Phaser.Scene,
  texture: string,
  start: Point,
  target: Point,
  display: { width: number; height: number },
  impact: () => void,
): void {
  const projectile = scene.add.image(start.x, start.y, texture)
    .setDisplaySize(display.width, display.height).setDepth(99);
  const tweenState = { t: 0 };
  let lastTrail = -1;
  const height = Math.min(65, Math.max(23, Math.abs(target.y - start.y) * .13));
  scene.tweens.add({
    targets: tweenState,
    t: 1,
    duration: projectileMs(start, target),
    ease: 'Linear',
    onUpdate: () => {
      const point = projectilePoint(start, target, tweenState.t, height);
      const next = projectilePoint(start, target, Math.min(1, tweenState.t + .02), height);
      projectile.setPosition(point.x, point.y);
      projectile.setRotation(Math.atan2(next.y-point.y,next.x-point.x)*.12);
      if (tweenState.t > lastTrail + .14 && tweenState.t < .92) {
        lastTrail = tweenState.t;
        const spark = scene.add.image(point.x, point.y, 'spark').setDepth(92)
          .setTint(0xffd88e).setScale(.9).setAlpha(.7);
        scene.tweens.add({
          targets: spark, alpha: 0, scale: .15, duration: 170,
          onComplete: () => spark.destroy(),
        });
      }
    },
    onComplete: () => {
      projectile.destroy();
      impact();
    },
  });
}

export function hitReaction(
  scene: Phaser.Scene,
  hero: Phaser.GameObjects.Sprite,
  baseScale: number,
  perfect: boolean,
): void {
  const initialAngle = hero.angle;
  scene.tweens.add({
    targets: hero,
    angle: initialAngle + (perfect ? 9 : 5),
    scaleX: baseScale * 1.065,
    scaleY: baseScale * .94,
    duration: 98,
    ease: 'Sine.easeOut',
    yoyo: true,
  });
  if (perfect) {
    scene.cameras.main.shake(110, .0023);
    scene.cameras.main.flash(90, 255, 215, 130);
  }
}

/** Optional slapstick exit; only runs after the target is inactive, so there is no moving hitbox. */
export function exitBehindTreeWithSlip(
 scene:Phaser.Scene,hero:Phaser.GameObjects.Sprite,plan:PopPlan,finished:()=>void,slip:boolean,
):void{
 if(!slip){exitBehindTree(scene,hero,plan,finished);return;}
 scene.tweens.killTweensOf(hero);
 // A quick overbalanced wobble before returning into the same tree.
 scene.tweens.add({
  targets:hero,x:hero.x+plan.side*13,y:hero.y+25,
  angle:plan.side*22,duration:96,ease:'Quad.easeOut',
  onComplete:()=>{
   if(!hero.active)return;
   exitBehindTree(scene,hero,plan,finished);
  },
 });
}
