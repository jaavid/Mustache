import Phaser from 'phaser';
import { selectExitMoment, selectHitMoment, selectSpawnMoment } from '../logic/moments';
import type { RaminVariant } from '../logic/variety';
import { applyRaminMood, raminLipPoint } from './ramin';

/**
 * Transient Ramin gestures. Facial expressions now select COMPLETE sprite
 * frames, not transparent graphics painted on top of existing eyes/eyebrows.
 * The optional hand and glasses remain independent physical accessories.
 */
export class RaminMomentController {
  private lastAt = -100000;
  private hand: Phaser.GameObjects.Image;
  private glassesMotion = { lift: 0 };
  private handMotion = { x: 45, y: 37 };
  private faceEvent: Phaser.Time.TimerEvent | null = null;
  private faceToken = 0;

  constructor(
    private scene: Phaser.Scene,
    private hero: Phaser.GameObjects.Sprite,
    private glasses: Phaser.GameObjects.Image,
    private portrait: boolean,
  ) {
    this.hand = scene.add.image(-300, -300, 'ramin-emote-hand').setDepth(45).setVisible(false);
  }

  /** Cancel any previous expression return before the next spawn. */
  clear(): void {
    this.faceToken++;
    this.faceEvent?.remove(false);
    this.faceEvent = null;
    this.scene.tweens.killTweensOf(this.glassesMotion);
    this.scene.tweens.killTweensOf(this.handMotion);
    this.glassesMotion = { lift: 0 };
    this.handMotion = { x: 45, y: 37 };
    this.hand.setVisible(false);
  }

  onSpawn(variant: RaminVariant): void {
    const kind = selectSpawnMoment(variant, Math.random(), this.scene.time.now, this.lastAt);
    if (!kind) return;
    this.lastAt = this.scene.time.now;
    if (kind === 'glasses-adjust') {
      // Only the detachable glasses texture lifts; eye graphics are not duplicated.
      this.scene.tweens.add({
        targets: this.glassesMotion,
        lift: -17,
        duration: 165,
        ease: 'Cubic.easeOut',
        yoyo: true,
        hold: 160,
      });
      return;
    }

    // Entirely replaces the original sprite frame until this gesture ends.
    const mood = kind === 'serious' ? 'serious' : 'wink';
    applyRaminMood(this.hero, mood);
    const token = ++this.faceToken;
    this.faceEvent = this.scene.time.delayedCall(540, () => {
      if (token !== this.faceToken || !this.hero.active || !this.hero.visible) return;
      const prefix = (this.hero.getData('character') as string | undefined) ?? 'ramin';
      const expected = kind === 'serious' ? `${prefix}-serious-hold` : `${prefix}-wink-hold`;
      // Do not interrupt surprised/victory after a projectile has arrived.
      if (this.hero.anims.currentAnim?.key === expected) applyRaminMood(this.hero, 'idle');
      this.faceEvent = null;
    });
  }

  onHit(grade: 'perfect' | 'good' | 'miss', combo: number): void {
    // Invalidate a pending wink/serious return so it cannot override the
    // surprised/victory reaction which the shot handler just selected.
    this.faceToken++;
    this.faceEvent?.remove(false);
    this.faceEvent = null;
    const kind = selectHitMoment(grade, combo, Math.random(), this.scene.time.now, this.lastAt);
    if (kind !== 'touch') return;
    this.lastAt = this.scene.time.now;
    this.handMotion = { x: 45, y: 37 };
    this.hand.setVisible(true).setAlpha(1);
    this.scene.tweens.add({
      targets: this.handMotion,
      x: 13,
      y: 8,
      duration: 170,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.handMotion,
          x: 46,
          y: 41,
          duration: 160,
          delay: 90,
          ease: 'Cubic.easeIn',
          onComplete: () => this.hand.setVisible(false),
        });
      },
    });
  }

  shouldSlip(): boolean {
    const kind = selectExitMoment(Math.random(), this.scene.time.now, this.lastAt);
    if (kind !== 'slip') return false;
    this.lastAt = this.scene.time.now;
    const pos = raminLipPoint(this.hero);
    const dust = this.scene.add
      .image(pos.x, pos.y + this.hero.displayHeight * 0.38, 'leaf-1')
      .setDepth(49)
      .setScale(this.portrait ? 3.8 : 2.8)
      .setAlpha(0.9);
    this.scene.tweens.add({
      targets: dust,
      y: dust.y - 12,
      x: dust.x + 21,
      alpha: 0,
      angle: 110,
      duration: 350,
      onComplete: () => dust.destroy(),
    });
    return true;
  }

  update(): void {
    if (!this.hero.active) return;
    const rot = this.hero.rotation,
      dy = this.glassesMotion.lift * this.hero.scaleY;
    if (this.glasses.visible)
      this.glasses.setPosition(
        this.glasses.x - Math.sin(rot) * dy,
        this.glasses.y + Math.cos(rot) * dy,
      );
    if (this.hand.visible) {
      const lip = raminLipPoint(this.hero),
        s = this.portrait ? 1.4 : 1.08;
      const x = this.handMotion.x * this.hero.scaleX,
        y = this.handMotion.y * this.hero.scaleY;
      this.hand
        .setPosition(
          lip.x + x * Math.cos(rot) - y * Math.sin(rot),
          lip.y + x * Math.sin(rot) + y * Math.cos(rot),
        )
        .setRotation(rot - 0.26)
        .setScale(s)
        .setAlpha(this.hero.alpha);
    }
  }
}
