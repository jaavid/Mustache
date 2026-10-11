import Phaser from 'phaser';
import {
  FACE_ATLAS_KEY,
  FACIAL_FRAME_HEIGHT,
  FACIAL_FRAME_WIDTH,
  FACE_FRAME_INDEX,
  FACE_PATCHES,
} from '../logic/facialLayout';

/**
 * Build whole-body, complete-face sprite frames from the existing artist-made
 * 4-frame sheet. Nothing is painted over a live face in the game scene.
 *
 * Wink: idle frame, with the LEFT EYE PIXELS replaced by the closed-eye source.
 * Brow raise: idle frame, with the BROW REGION replaced by the raised brows
 * from the supplied surprised drawing. Neither operation adds new eyebrows.
 *
 * All 6 frames are 210x362 and retain the exact same upper-lip anchor.
 */
export function createFacialAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists(FACE_ATLAS_KEY)) return;
  const source = scene.textures.get('ramin-sheet');
  const first = source.get(0);
  const image = first.source.image as CanvasImageSource;
  const w = FACIAL_FRAME_WIDTH,
    h = FACIAL_FRAME_HEIGHT;
  const atlas = document.createElement('canvas');
  atlas.width = w * 6;
  atlas.height = h;
  const ctx = atlas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Cannot initialize Ramin facial sprite sheet');

  const drawOriginal = (index: number, destIndex: number) => {
    const frame = source.get(index);
    ctx.drawImage(image, frame.cutX, frame.cutY, w, h, destIndex * w, 0, w, h);
  };
  for (let frame = 0; frame < 4; frame++) drawOriginal(frame, frame);
  drawOriginal(FACE_FRAME_INDEX.idle, FACE_FRAME_INDEX.wink);
  drawOriginal(FACE_FRAME_INDEX.idle, FACE_FRAME_INDEX.serious);

  /** Replace source pixels with no additional foreground layer. Use a tiny
   * 3px edge feather for mismatched lighting between the supplied poses.
   */
  const replaceRegion = (
    sourceFrame: number,
    destFrame: number,
    patch: { x: number; y: number; width: number; height: number },
  ) => {
    const frame = source.get(sourceFrame);
    const helper = document.createElement('canvas');
    helper.width = patch.width;
    helper.height = patch.height;
    const helperCtx = helper.getContext('2d', { willReadFrequently: true });
    if (!helperCtx) throw new Error('Cannot render facial replacement');
    helperCtx.drawImage(
      image,
      frame.cutX + patch.x,
      frame.cutY + patch.y,
      patch.width,
      patch.height,
      0,
      0,
      patch.width,
      patch.height,
    );
    const src = helperCtx.getImageData(0, 0, patch.width, patch.height);
    const dstX = destFrame * w + patch.x;
    const dst = ctx.getImageData(dstX, patch.y, patch.width, patch.height);
    for (let y = 0; y < patch.height; y++) {
      for (let x = 0; x < patch.width; x++) {
        const i = (y * patch.width + x) * 4;
        const border = Math.min(x, y, patch.width - 1 - x, patch.height - 1 - y);
        const fraction = Math.min(1, (border + 1) / 4);
        const opacity = (src.data[i + 3] / 255) * fraction;
        for (let channel = 0; channel < 3; channel++) {
          dst.data[i + channel] = Math.round(
            dst.data[i + channel] * (1 - opacity) + src.data[i + channel] * opacity,
          );
        }
        dst.data[i + 3] = Math.max(dst.data[i + 3], src.data[i + 3]);
      }
    }
    ctx.putImageData(dst, dstX, patch.y);
  };
  replaceRegion(FACE_FRAME_INDEX.blink, FACE_FRAME_INDEX.wink, FACE_PATCHES.wink);
  replaceRegion(FACE_FRAME_INDEX.surprised, FACE_FRAME_INDEX.serious, FACE_PATCHES.serious);

  // TextureManager.addSpriteSheet accepts an HTMLImageElement or Phaser Texture,
  // not a raw HTMLCanvasElement in Phaser 3.90. Register the canvas itself
  // then define six explicit frame rectangles on its CanvasTexture.
  const texture = scene.textures.addCanvas(FACE_ATLAS_KEY, atlas);
  if (!texture) throw new Error('Cannot register Ramin facial sprite sheet');
  for (let frame = 0; frame <= FACE_FRAME_INDEX.serious; frame++)
    texture.add(frame, 0, frame * w, 0, w, h);
}
