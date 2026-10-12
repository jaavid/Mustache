import Phaser from 'phaser';
import type { RaminVariant } from '../logic/variety';
import { getSelectedCharacter, type CharacterId } from './characterChoice';

/** Full-frame overlays inherit hero transform; different face geometry is
 * calibrated in the two different accessory textures.
 */
export function makeAccessory(scene: Phaser.Scene): Phaser.GameObjects.Image {
  const character = getSelectedCharacter();
  return scene.add
    .image(-300, -300, character + '-acc-normal')
    .setData('character', character)
    .setDepth(22)
    .setVisible(false);
}

export function selectAccessory(image: Phaser.GameObjects.Image, variant: RaminVariant): void {
  const character = (image.getData('character') as CharacterId) || 'ramin';
  image
    .setTexture(character + '-acc-' + variant)
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
    .setDisplaySize(hero.displayWidth, hero.displayHeight)
    .setAlpha(hero.alpha)
    .setVisible(hero.visible && image.getData('costume') !== 'normal');
}
