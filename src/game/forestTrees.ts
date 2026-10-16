import Phaser from 'phaser';
import { DESKTOP_TREE_CENTERS, MOBILE_TREE_CENTERS } from '../logic/treeGeometry';

/** All visual sprite axes line up with the server-independent trunk collision lanes.
 * Crowns sway while bark remains stationary, so a missed shot never targets a moving tree.
 */
export function addGameplayTrees(scene: Phaser.Scene, portrait: boolean): void {
  const centers = portrait ? MOBILE_TREE_CENTERS : DESKTOP_TREE_CENTERS;
  const y = portrait ? 552 : 300;
  const width = portrait ? 146 : 190;
  const height = 430;
  const reduceMotion =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  centers.forEach((center, index) => {
    // A grounding shadow also separates each root flare from the fern floor.
    scene.add
      .ellipse(center, portrait ? 735 : 489, width * 0.72, 24, 0x071c1c, 0.38)
      .setDepth(13);
    const crown = scene.add
      .image(center, y, `tree-back-${index}`)
      .setDisplaySize(width, height)
      .setDepth(14);
    if (!reduceMotion) {
      scene.tweens.add({
        targets: crown,
        angle: index === 1 ? -0.65 : 0.65,
        duration: (portrait ? 2600 : 2900) + index * 330,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
    scene.add
      .image(center, y, `tree-front-${index}`)
      .setDisplaySize(width, height)
      .setDepth(28);
  });
}
