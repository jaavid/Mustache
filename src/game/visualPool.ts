import type Phaser from 'phaser';

const MAX_REUSABLE_PER_TEXTURE = 12;
const scenePools = new WeakMap<Phaser.Scene, Map<string, Phaser.GameObjects.Image[]>>();

function poolsFor(scene: Phaser.Scene): Map<string, Phaser.GameObjects.Image[]> {
  let pools = scenePools.get(scene);
  if (!pools) {
    pools = new Map();
    scenePools.set(scene, pools);
    // Phaser owns these display objects. Forget their pools on scene shutdown.
    scene.events.once('shutdown', () => scenePools.delete(scene));
  }
  return pools;
}

/** Reset *all* mutable visual state so a recycled trail cannot inherit tint,
 * alpha, rotation or dimensions from its previous use.
 */
export function acquireVisual(scene: Phaser.Scene, texture: string): Phaser.GameObjects.Image {
  const pool = poolsFor(scene).get(texture);
  const image = pool?.pop() ?? scene.add.image(0, 0, texture);
  scene.tweens.killTweensOf(image);
  return image
    .setTexture(texture)
    .setActive(true)
    .setVisible(true)
    .setAlpha(1)
    .setAngle(0)
    .setScale(1)
    .clearTint();
}

export function releaseVisual(
  scene: Phaser.Scene,
  texture: string,
  image: Phaser.GameObjects.Image,
): void {
  if (!image.active) return;
  scene.tweens.killTweensOf(image);
  image.setVisible(false).setActive(false);
  const pool = scenePools.get(scene)?.get(texture) ?? [];
  if (pool.length >= MAX_REUSABLE_PER_TEXTURE) {
    image.destroy();
    return;
  }
  pool.push(image);
  scenePools.get(scene)?.set(texture, pool);
}
