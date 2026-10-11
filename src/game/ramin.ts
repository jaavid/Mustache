import Phaser from 'phaser';
import { rotatedOffsetPoint } from '../logic/rotatedOffsetPoint';
import { FACE_ATLAS_KEY, FACE_FRAME_INDEX } from '../logic/facialLayout';
import { createFacialAtlas } from './facialAtlas';

const raminSheetUrl = new URL('../assets/ramin-sheet.png', import.meta.url).href;

export const RAMIN_FRAME_WIDTH = 210;
export const RAMIN_FRAME_HEIGHT = 362;
export const RAMIN_DESKTOP_SCALE = 0.64;
export const RAMIN_MOBILE_SCALE = 0.82;
const LIP_X_RATIO = 0;
const LIP_Y_RATIO = 136 / RAMIN_FRAME_HEIGHT - 0.5; // calibrated upper-lip point across aligned frames

export type RaminMood = 'idle' | 'blink' | 'surprised' | 'victory' | 'wink' | 'serious';

export function preloadRamin(scene: Phaser.Scene): void {
  if (!scene.textures.exists('ramin-sheet')) {
    scene.load.spritesheet('ramin-sheet', raminSheetUrl, {
      frameWidth: RAMIN_FRAME_WIDTH,
      frameHeight: RAMIN_FRAME_HEIGHT,
      startFrame: 0,
      endFrame: 3,
    });
  }
}

export function ensureRaminAnimations(scene: Phaser.Scene): void {
  createFacialAtlas(scene);
  const { anims } = scene;
  if (!anims.exists('ramin-blink-loop')) {
    anims.create({
      key: 'ramin-blink-loop',
      frames: [{ key: FACE_ATLAS_KEY, frame: FACE_FRAME_INDEX.idle }, { key: FACE_ATLAS_KEY, frame: FACE_FRAME_INDEX.blink }, { key: FACE_ATLAS_KEY, frame: FACE_FRAME_INDEX.idle }],
      frameRate: 5,
      repeat: -1,
      repeatDelay: 2800,
    });
  }
  if (!anims.exists('ramin-idle-hold')) {
    anims.create({
      key: 'ramin-idle-hold',
      frames: [{ key: FACE_ATLAS_KEY, frame: FACE_FRAME_INDEX.idle }],
      frameRate: 1,
      repeat: -1,
    });
  }
  if (!anims.exists('ramin-surprised-hold')) {
    anims.create({
      key: 'ramin-surprised-hold',
      frames: [{ key: FACE_ATLAS_KEY, frame: FACE_FRAME_INDEX.surprised }],
      frameRate: 1,
      repeat: -1,
    });
  }
  if (!anims.exists('ramin-wink-hold')) {
    anims.create({
      key: 'ramin-wink-hold',
      frames: [{ key: FACE_ATLAS_KEY, frame: FACE_FRAME_INDEX.wink }],
      frameRate: 1,
      repeat: -1,
    });
  }
  if (!anims.exists('ramin-serious-hold')) {
    anims.create({
      key: 'ramin-serious-hold',
      frames: [{ key: FACE_ATLAS_KEY, frame: FACE_FRAME_INDEX.serious }],
      frameRate: 1,
      repeat: -1,
    });
  }
  if (!anims.exists('ramin-victory-bounce')) {
    anims.create({
      key: 'ramin-victory-bounce',
      frames: [{ key: FACE_ATLAS_KEY, frame: FACE_FRAME_INDEX.victory }],
      frameRate: 1,
      repeat: -1,
    });
  }
}

export function makeRamin(scene: Phaser.Scene, x: number, y: number, scale: number, mood: RaminMood = 'idle'): Phaser.GameObjects.Sprite {
  const hero = scene.add.sprite(x, y, FACE_ATLAS_KEY, FACE_FRAME_INDEX.idle).setScale(scale).setDepth(20);
  applyRaminMood(hero, mood);
  return hero;
}

export function applyRaminMood(hero: Phaser.GameObjects.Sprite, mood: RaminMood): void {
  switch (mood) {
    case 'wink':
      hero.play('ramin-wink-hold');
      break;
    case 'serious':
      hero.play('ramin-serious-hold');
      break;
    case 'blink':
      hero.play('ramin-blink-loop');
      break;
    case 'surprised':
      hero.play('ramin-surprised-hold');
      break;
    case 'victory':
      hero.play('ramin-victory-bounce');
      break;
    default:
      hero.play('ramin-idle-hold');
      break;
  }
}

export function raminLipPoint(hero: Phaser.GameObjects.Sprite): { x: number; y: number } {
  // Rotate the mouth offset with the hero; a plain x/y offset drifts off the face.
  return rotatedOffsetPoint(
    hero.x,
    hero.y,
    hero.displayWidth * LIP_X_RATIO,
    hero.displayHeight * LIP_Y_RATIO,
    hero.rotation,
  );
}
