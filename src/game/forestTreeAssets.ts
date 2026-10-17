import Phaser from 'phaser';

/** Karsiori CC0 source sprites, with shared 96×220 virtual coordinates.
 * Keep the sprite files bundled by Vite (rather than hard-coded root URLs).
 */
const oakUrl = new URL('../assets/forest/karsiori-oak-tree6-green.png', import.meta.url).href;
const cedarUrl = new URL(
  '../assets/forest/karsiori-large-spruce-night-sheet.png',
  import.meta.url,
).href;

export const TREE_TEXTURE_SIZE = { width: 96, height: 220 } as const;

type Species = 'oak' | 'cedar';
type Layer = 'back' | 'front';

export function preloadForestTreeSources(scene: Phaser.Scene): void {
  scene.load.image('forest-oak-source', oakUrl);
  // The CC0 cedar sheet is 25 horizontal animation frames, 74×128 each.
  // The first frame is sufficient for an anchored sprite; the canopy motion
  // comes from Phaser's subtle tween, not a moving hitbox.
  scene.load.image('forest-cedar-source', cedarUrl);
}

function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawTrunk(ctx: CanvasRenderingContext2D, species: Species, layer: Layer): void {
  const oak = species === 'oak';
  const darkest = oak ? '#272a28' : '#202b33';
  const shadow = oak ? '#433c33' : '#39433d';
  const bark = oak ? '#755a43' : '#5b6553';
  const light = oak ? '#a17b51' : '#879473';
  const moss = oak ? '#537854' : '#5e8268';

  // An uninterrupted trunk is essential for stable front occlusion. Back is a
  // slender silhouette; front stays on the exact x=48 collision lane.
  if (layer === 'back') {
    drawPixelRect(ctx, 43, 81, 11, 125, darkest);
    drawPixelRect(ctx, 46, 83, 6, 125, shadow);
    drawPixelRect(ctx, 29, 94, 23, 6, shadow);
    drawPixelRect(ctx, 50, 103, 21, 6, shadow);
    return;
  }

  // Only foreground bark occludes the hero. The tall crown and broad
  // branches never cover the face or projectile visually.
  drawPixelRect(ctx, 37, 94, 25, 106, darkest);
  drawPixelRect(ctx, 40, 93, 20, 107, shadow);
  drawPixelRect(ctx, 45, 92, 13, 106, bark);
  drawPixelRect(ctx, 48, 98, 4, 96, light);
  drawPixelRect(ctx, 59, 105, 3, 89, darkest);
  // Two different roots: a wide rounded oak flare and narrow fir roots.
  drawPixelRect(ctx, oak ? 27 : 32, 191, oak ? 44 : 34, 11, shadow);
  drawPixelRect(ctx, oak ? 18 : 25, 200, oak ? 61 : 49, 8, darkest);
  drawPixelRect(ctx, oak ? 25 : 31, 204, oak ? 48 : 37, 4, bark);
  drawPixelRect(ctx, 39, 205, 23, 3, moss);

  // Repeatable bark grain, knots and moss: stable pixel art, not random
  // graphics work on every frame.
  for (let i = 0; i < 36; i++) {
    const x = 40 + ((i * 11 + (oak ? 3 : 7)) % 19);
    const y = 102 + ((i * 31) % 91);
    drawPixelRect(ctx, x, y, 2, 3 + (i % 7), i % 5 === 0 ? light : i % 3 ? bark : shadow);
  }
  for (let i = 0; i < 14; i++) {
    const x = 36 + ((i * 13) % 27);
    const y = 137 + ((i * 19) % 63);
    drawPixelRect(ctx, x, y, 2 + (i % 3), 2, moss);
  }
  for (const y of [128, 172]) {
    drawPixelRect(ctx, 46, y, 9, 10, darkest);
    drawPixelRect(ctx, 48, y + 2, 5, 5, bark);
  }
}

function drawBack(
  ctx: CanvasRenderingContext2D,
  species: Species,
  oakImage: CanvasImageSource,
  cedarImage: CanvasImageSource,
): void {
  drawTrunk(ctx, species, 'back');
  // Original Karsiori foliage is retained unmodified apart from nearest-
  // neighbour scaling/cropping into the common virtual canvas. The author's
  // distinct silhouette is what determines Oak vs. Cedar.
  if (species === 'oak') {
    ctx.drawImage(oakImage, 0, 0, 70, 98, 4, 5, 88, 148);
  } else {
    // One complete frame from the 1850×128 original sheet (25 × 74px).
    ctx.drawImage(cedarImage, 0, 0, 74, 128, 7, 3, 82, 170);
  }
}

export function createForestTreeTextures(scene: Phaser.Scene): void {
  const oak = scene.textures.get('forest-oak-source').getSourceImage() as CanvasImageSource;
  const cedar = scene.textures.get('forest-cedar-source').getSourceImage() as CanvasImageSource;
  for (const species of ['oak', 'cedar'] as const) {
    for (const layer of ['back', 'front'] as const) {
      const key = `tree-${species}-${layer}`;
      const tex = scene.textures.createCanvas(
        key,
        TREE_TEXTURE_SIZE.width,
        TREE_TEXTURE_SIZE.height,
      );
      if (!tex) throw new Error('Missing forest tree canvas texture: ' + key);
      const ctx = tex.getContext();
      ctx.imageSmoothingEnabled = false;
      if (layer === 'back') drawBack(ctx, species, oak, cedar);
      else drawTrunk(ctx, species, 'front');
      tex.refresh();
    }
  }
}
