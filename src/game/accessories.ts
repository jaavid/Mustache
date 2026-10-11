import Phaser from 'phaser';
import type { RaminVariant } from '../logic/variety';

/** Full-frame accessory images share Ramin's frame dimensions and origin.
 * Depth 22 sits above his sprite (20) but behind the tree bark (28).
 */
export function makeAccessory(scene: Phaser.Scene): Phaser.GameObjects.Image {
  return scene.add.image(-300, -300, 'ramin-acc-normal').setDepth(22).setVisible(false);
}
export function selectAccessory(image: Phaser.GameObjects.Image, variant: RaminVariant): void {
  image
    .setTexture('ramin-acc-' + variant)
    .setData('costume', variant)
    .setVisible(false);
}
export function syncAccessory(
  hero: Phaser.GameObjects.Sprite,
  image: Phaser.GameObjects.Image,
): void {
  image
    .setPosition(hero.x, hero.y)
    .setRotation(hero.rotation)
    .setScale(hero.scaleX, hero.scaleY)
    .setAlpha(hero.alpha)
    .setVisible(hero.visible && image.getData('costume') !== 'normal');
}
