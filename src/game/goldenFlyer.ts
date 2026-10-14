import Phaser from 'phaser';
import {
  goldenHit,
  goldenPosition,
  GOLDEN_REQUIRED,
  GOLDEN_SPAWN_MS,
} from '../../shared/goldenRules.js';
import { recordCompetitiveGoldenPickup } from '../platform/competitiveScores';
import { mustacheTexture } from './characterChoice';

/** Cosmetic and input presentation only; authoritative flight rules live in shared/. */
export class GoldenFlyer {
  private readonly scene: Phaser.Scene;
  private readonly portrait: boolean;
  private readonly notice: (message: string, color: string) => void;
  private readonly onChargeChange: (ready: boolean) => void;
  private readonly goldRush: boolean;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly hud: Phaser.GameObjects.Text;
  private readonly collected = new Set<number>();
  private spent = false;

  constructor(
    scene: Phaser.Scene,
    portrait: boolean,
    notice: (message: string, color: string) => void,
    onChargeChange: (ready: boolean) => void,
    goldRush = false,
  ) {
    this.scene = scene;
    this.portrait = portrait;
    this.notice = notice;
    this.onChargeChange = onChargeChange;
    this.goldRush = goldRush;
    this.glow = scene.add
      .circle(-100, -100, portrait ? 39 : 34, 0xffd84e, 0.2)
      .setDepth(120)
      .setVisible(false);
    this.sprite = scene.add
      .image(-100, -100, mustacheTexture(1, true))
      .setDisplaySize(portrait ? 80 : 74, portrait ? 44 : 40)
      .setDepth(121)
      .setVisible(false);
    scene.tweens.add({
      targets: this.glow,
      scale: 1.22,
      alpha: 0.07,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    this.hud = scene.add
      .text(
        portrait ? 270 : 480,
        portrait ? 742 : 433,
        goldRush ? 'PERFECT 0/3 · +150' : 'GOLD 0/3',
        {
          fontFamily: '"Courier New", monospace',
          fontSize: portrait ? '20px' : '18px',
          fontStyle: 'bold',
          color: '#ffe69b',
          backgroundColor: '#172038',
          stroke: '#322345',
          strokeThickness: 3,
          padding: { x: 9, y: 5 },
        },
      )
      .setOrigin(0.5)
      .setDepth(119);
  }

  /** Gold Rush is a streak mechanic, not a collectible charge. */
  setPerfectStreak(streak: number): void {
    if (!this.goldRush) return;
    this.hud.setText('PERFECT ' + (streak % 3) + '/3 · +150');
  }

  get ready(): boolean {
    return this.collected.size >= GOLDEN_REQUIRED && !this.spent;
  }

  update(elapsedMs: number): void {
    if (this.collected.size >= GOLDEN_REQUIRED || this.spent) {
      this.sprite.setVisible(false);
      this.glow.setVisible(false);
      return;
    }
    let active: { x: number; y: number } | null = null;
    for (let i = 0; i < GOLDEN_SPAWN_MS.length; i++) {
      if (this.collected.has(i)) continue;
      active = goldenPosition(i, elapsedMs, this.portrait);
      if (active) break;
    }
    const visible = !!active;
    this.sprite.setVisible(visible);
    this.glow.setVisible(visible);
    if (active) {
      this.sprite.setPosition(active.x, active.y);
      this.glow.setPosition(active.x, active.y);
    }
  }

  /** Pickups never consume a Ramin shot or modify the combo counter. */
  tryCollect(x: number, y: number, elapsedMs: number): boolean {
    if (this.ready || this.spent) return false;
    for (let i = 0; i < GOLDEN_SPAWN_MS.length; i++) {
      if (this.collected.has(i) || !goldenHit(i, elapsedMs, { x, y }, this.portrait)) continue;
      this.collected.add(i);
      recordCompetitiveGoldenPickup({
        index: i,
        tMs: Math.min(46000, Math.round(elapsedMs)),
        aim: { x, y },
      });
      this.sprite.setVisible(false);
      this.glow.setVisible(false);
      this.hud.setText(this.ready ? 'GOLD READY · SLOT 2' : 'GOLD ' + this.collected.size + '/3');
      if (this.ready) this.onChargeChange(true);
      this.scene.tweens.add({ targets: this.hud, scale: 1.25, duration: 140, yoyo: true });
      this.notice(
        this.ready ? 'GOLD READY! SELECT 2' : 'GOLD COLLECTED! ' + this.collected.size + '/3',
        '#ffe58b',
      );
      return true;
    }
    return false;
  }

  /** Only called for a deliberately equipped golden slot. GOOD/MISS still spend it. */
  consume(): boolean {
    if (!this.ready) return false;
    this.spent = true;
    this.hud.setText('GOLD USED');
    this.onChargeChange(false);
    return true;
  }
}
