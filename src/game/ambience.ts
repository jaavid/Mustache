import Phaser from 'phaser';

/** Scene-local decorative effects. No external assets, update loops, or timers survive a scene shutdown. */
export function addForestLife(scene: Phaser.Scene): void {
  const reduceMotion =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const mistBack = scene.add.image(445, 334, 'mist').setScale(2).setAlpha(0.22).setDepth(5);
  const mistFront = scene.add.image(560, 427, 'mist').setScale(2.1).setAlpha(0.25).setDepth(32);
  if (!reduceMotion) scene.tweens.add({
    targets: mistBack,
    x: 550,
    alpha: 0.36,
    duration: 7800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
  if (!reduceMotion) scene.tweens.add({
    targets: mistFront,
    x: 395,
    alpha: 0.13,
    duration: 9900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
  scene.add.image(480, 457, 'forest-front').setScale(2).setDepth(37);

  // Fireflies/butterflies in front of the forest, behind the HUD and prompts.
  for (let i = 0; i < 9; i++) {
    const x = 55 + ((i * 263) % 845);
    const y = 172 + ((i * 137) % 220);
    const insect = scene.add
      .image(x, y, i % 3 === 0 ? 'butterfly' : 'spark')
      .setScale(i % 3 === 0 ? 1.6 : 0.8)
      .setAlpha(0.55)
      .setDepth(11);
    if (reduceMotion) continue;
    scene.tweens.add({
      targets: insect,
      x: x + (i % 2 ? -32 : 32),
      y: y - 22,
      alpha: i % 3 === 0 ? 0.77 : 0.14,
      duration: 2100 + i * 290,
      yoyo: true,
      repeat: -1,
      delay: i * 135,
      ease: 'Sine.inOut',
    });
  }
}

export function burstLeaves(scene: Phaser.Scene, x: number, y: number, count = 9): void {
  for (let i = 0; i < count; i++) {
    const leaf = scene.add
      .image(x, y, `leaf-${i % 3}`)
      .setScale(1.5 + (i % 3) * 0.25)
      .setDepth(48)
      .setAngle(Phaser.Math.Between(-50, 50));
    scene.tweens.add({
      targets: leaf,
      x: x + Phaser.Math.Between(-90, 90),
      y: y + Phaser.Math.Between(-84, 28),
      rotation: Phaser.Math.FloatBetween(-2.8, 2.8),
      alpha: 0,
      duration: Phaser.Math.Between(560, 1000),
      ease: 'Quad.easeOut',
      onComplete: () => leaf.destroy(),
    });
  }
}

export function burstStars(scene: Phaser.Scene, x: number, y: number, perfect: boolean): void {
  const palette = perfect ? [0xffe4a5, 0xffc65a, 0xe8c4ff] : [0xa4f4d2, 0xddf9ad];
  const amount = perfect ? 18 : 11;
  for (let i = 0; i < amount; i++) {
    const angle = (i / amount) * Math.PI * 2;
    const radius = Phaser.Math.Between(40, perfect ? 108 : 75);
    const star = scene.add
      .image(x, y, 'spark')
      .setTint(palette[i % palette.length])
      .setScale(i % 3 === 0 ? 2.1 : 1.25)
      .setDepth(96);
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
      alpha: 0,
      scale: 0.3,
      duration: Phaser.Math.Between(440, 720),
      ease: 'Cubic.easeOut',
      onComplete: () => star.destroy(),
    });
  }
}
