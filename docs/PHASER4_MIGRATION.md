# Phaser 4 migration checklist

This PR upgrades **Phaser 3.90** to **Phaser 4.2.1** without changing the
server-side scoring contract or game design.

## Renderer compatibility

The game uses Phaser's standard Sprite, Image, Text, Graphics, Camera,
CanvasTexture and Input APIs. It has no custom WebGL pipelines or shaders.
The Phaser 4 render-node architecture replaces the renderer internally.
Existing hand-drawn sunlight, mist and gold-vault layers stay in place;
this migration does not introduce new lighting or filters.

Keep `roundPixels: true` to preserve the pixel-art intent, but manually
inspect movement in both orientations: Phaser 4 rounds only safe,
axis-aligned, unscaled transforms by default.

## Game-feel polish

- Stage toast is smaller and lasts 720ms rather than obstructing play for 2.65 seconds.
- Perfect uses character-local impact motion and a rare gold glow, not camera shake
  or the former global Phaser tween timeScale (which also affected projectiles).
- Leaf bursts only come from real bark hits, not air misses.
- Reduced-motion preference suppresses new motion; no scoring rules have changed.

## Validation

- [ ] Play desktop at 960×540 and portrait at 540×960 in Chromium.
- [ ] Confirm character sprites, facial animation, textures and forest layers.
- [ ] Test projectiles hitting faces, trunks and missed shots; compare scores.
- [ ] Confirm golden collectibles and Gold Rush visuals/scoring.
- [ ] Confirm overlays, results, touch controls and landscape transitions.
- [ ] Test Telegram WebView on Android and iOS (manual release gate).
- [ ] Confirm no runtime errors, black canvas or degraded frame rate.

Automated checks: `npm run check`, `npm run test:bot` and
`npm run test:e2e` (browser smoke with screenshots).

Reference: https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md
