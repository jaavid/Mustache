import Phaser from 'phaser';
import {
  TREE_CANVAS_SIZE,
  TREE_SOURCE_REGISTRATION,
  TREE_TRUNK_OCCLUSION,
  type ForestSpecies,
} from '../logic/forestArtLayout';

/** Original Karsiori CC0 sprites; the artist's natural bark is the ONLY trunk. */
const oakUrl = new URL('../assets/forest/karsiori-oak-tree6-green.png', import.meta.url).href;
const cedarUrl = new URL('../assets/forest/karsiori-large-spruce-night-sheet.png', import.meta.url)
  .href;

export function preloadForestTreeSources(scene: Phaser.Scene): void {
  scene.load.image('forest-oak-source', oakUrl);
  scene.load.image('forest-cedar-source', cedarUrl);
}

/** Both layers project the *same* original source pixels into the *same* canvas.
 * Back: complete tree; Front: only bark/low branches clipped from that image.
 * Repainting a rectangular trunk over a CC0 source sprite previously left the
 * obsolete beige posts visible under the new crowns.
 */
function drawTreeLayer(
  ctx: CanvasRenderingContext2D,
  species: ForestSpecies,
  layer: 'back' | 'front',
  source: CanvasImageSource,
): void {
  const rect = TREE_SOURCE_REGISTRATION[species];
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  const points = TREE_TRUNK_OCCLUSION[species];
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  // Exactly one visual copy of each source pixel: the foreground contains
  // stationary bark; the back contains only the surrounding swaying crown.
  if (layer === 'front') ctx.clip();
  // The cedar sheet consists of 25 frames; sample only its first 74×128 frame.
  ctx.drawImage(
    source,
    0,
    0,
    rect.sourceWidth,
    rect.sourceHeight,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
  );
  if (layer === 'back') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
  }
  ctx.restore();
}

export function createForestTreeTextures(scene: Phaser.Scene): void {
  const sources: Record<ForestSpecies, CanvasImageSource> = {
    oak: scene.textures.get('forest-oak-source').getSourceImage() as CanvasImageSource,
    cedar: scene.textures.get('forest-cedar-source').getSourceImage() as CanvasImageSource,
  };
  for (const species of ['oak', 'cedar'] as const) {
    for (const layer of ['back', 'front'] as const) {
      const key = `tree-${species}-${layer}`;
      const tex = scene.textures.createCanvas(key, TREE_CANVAS_SIZE.width, TREE_CANVAS_SIZE.height);
      if (!tex) throw new Error('Missing forest tree canvas texture: ' + key);
      drawTreeLayer(tex.getContext(), species, layer, sources[species]);
      tex.refresh();
    }
  }
}
