import Phaser from 'phaser';

/** Decorative, pixel-snapped gold vault. Trees remain as gameplay occluders, so hit
 * boxes, lanes, character timing and projectile geometry stay unchanged.
 */
export function addGoldVault(scene: Phaser.Scene, portrait: boolean): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const g = scene.add.graphics().setDepth(-18);
  g.fillStyle(0x201524, 1);
  g.fillRect(0, 0, w, h);
  const ceiling = portrait ? 265 : 90;
  const floor = portrait ? 775 : 460;
  g.fillStyle(0x513424, 1);
  g.fillRect(0, ceiling, w, floor - ceiling);
  g.fillStyle(0x835727, 1);
  g.fillRect(0, floor - 38, w, 40);
  // Pixel-block vault door and golden ornamental pillars.
  g.fillStyle(0xb78b38, 1);
  g.fillRoundedRect(w * 0.19, ceiling + 35, w * 0.62, floor - ceiling - 52, 85);
  g.fillStyle(0x31223c, 1);
  g.fillRoundedRect(w * 0.225, ceiling + 56, w * 0.55, floor - ceiling - 73, 70);
  g.lineStyle(8, 0xffd77c, 0.8);
  for (const x of [w * 0.09, w * 0.91]) {
    g.strokeRect(x - 20, ceiling + 15, 40, floor - ceiling - 35);
  }
  for (let i = 0; i < 60; i++) {
    const x = 13 + ((i * 101 + 17) % (w - 26));
    const y = ceiling + 12 + ((i * 67) % (floor - ceiling - 30));
    g.fillStyle(i % 4 === 0 ? 0xffedaa : 0xd9a54d, i % 4 === 0 ? 0.9 : 0.5);
    g.fillRect(Math.round(x), Math.round(y), i % 3 === 0 ? 6 : 3, i % 3 === 0 ? 6 : 3);
  }
  scene.add.rectangle(w / 2, h / 2, w, h, 0xffc34f, 0.16).setDepth(40.5);
  scene.add
    .text(w / 2, portrait ? 247 : 137, '★ GOLD RUSH ★', {
      fontFamily: '"Courier New", monospace',
      fontSize: portrait ? '26px' : '24px',
      color: '#ffe3a0',
      fontStyle: 'bold',
      stroke: '#341825',
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(48);
}
