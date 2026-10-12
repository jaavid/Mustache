import Phaser from 'phaser';
import { rotatedOffsetPoint } from '../logic/rotatedOffsetPoint';
import { FACE_ATLAS_KEY, FACE_FRAME_INDEX } from '../logic/facialLayout';
import { createFacialAtlas } from './facialAtlas';
import { getSelectedCharacter, type CharacterId } from './characterChoice';

const raminSheetUrl = new URL('../assets/ramin-sheet.png', import.meta.url).href;
const borhanSheetUrl = new URL('../assets/borhan-sheet.png', import.meta.url).href;
const BORHAN_ATLAS_KEY = 'borhan-face-atlas-v1';

export const RAMIN_FRAME_WIDTH = 210;
export const RAMIN_FRAME_HEIGHT = 362;
export const RAMIN_DESKTOP_SCALE = 0.64;
export const RAMIN_MOBILE_SCALE = 0.82;
const LIP_X_RATIO = 0;
const RAMIN_LIP_SOURCE_Y = 136;
const BORHAN_LIP_SOURCE_Y = 125; // approved clean sprite: just below nose, upper lip

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
  if (!scene.textures.exists('borhan-sheet')) {
    scene.load.spritesheet('borhan-sheet', borhanSheetUrl, {
      frameWidth: RAMIN_FRAME_WIDTH,
      frameHeight: RAMIN_FRAME_HEIGHT,
      startFrame: 0,
      endFrame: 3,
    });
  }
}

export function ensureRaminAnimations(scene: Phaser.Scene): void {
  createFacialAtlas(scene);
  createFacialAtlas(scene, 'borhan-sheet', BORHAN_ATLAS_KEY);
  const { anims } = scene;
  if (!anims.exists('ramin-blink-loop')) {
    anims.create({
      key: 'ramin-blink-loop',
      frames: [
        { key: FACE_ATLAS_KEY, frame: FACE_FRAME_INDEX.idle },
        { key: FACE_ATLAS_KEY, frame: FACE_FRAME_INDEX.blink },
        { key: FACE_ATLAS_KEY, frame: FACE_FRAME_INDEX.idle },
      ],
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
  // Borhan uses separate animation keys, keeping existing Ramin keys unmodified.
  const poses: [string, number[]][] = [
    ['blink-loop', [FACE_FRAME_INDEX.idle, FACE_FRAME_INDEX.blink, FACE_FRAME_INDEX.idle]],
    ['idle-hold', [FACE_FRAME_INDEX.idle]],
    ['surprised-hold', [FACE_FRAME_INDEX.surprised]],
    ['wink-hold', [FACE_FRAME_INDEX.wink]],
    ['serious-hold', [FACE_FRAME_INDEX.serious]],
    ['victory-bounce', [FACE_FRAME_INDEX.victory]],
  ];
  for (const [name, frames] of poses) {
    const key = 'borhan-' + name;
    if (!anims.exists(key)) {
      anims.create({
        key,
        frames: frames.map((frame) => ({ key: BORHAN_ATLAS_KEY, frame })),
        frameRate: name === 'blink-loop' ? 5 : 1,
        repeat: -1,
        repeatDelay: name === 'blink-loop' ? 2800 : 0,
      });
    }
  }
}

export function makeCharacter(
  scene: Phaser.Scene,
  character: CharacterId,
  x: number,
  y: number,
  scale: number,
  mood: RaminMood = 'idle',
): Phaser.GameObjects.Sprite {
  const atlas = character === 'borhan' ? BORHAN_ATLAS_KEY : FACE_ATLAS_KEY;
  const hero = scene.add.sprite(x, y, atlas, FACE_FRAME_INDEX.idle).setScale(scale).setDepth(20);
  hero.setData('character', character);
  applyRaminMood(hero, mood);
  return hero;
}

export function makeRamin(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  mood: RaminMood = 'idle',
): Phaser.GameObjects.Sprite {
  return makeCharacter(scene, getSelectedCharacter(), x, y, scale, mood);
}

export function applyRaminMood(hero: Phaser.GameObjects.Sprite, mood: RaminMood): void {
  const prefix = hero.getData('character') === 'borhan' ? 'borhan' : 'ramin';
  switch (mood) {
    case 'wink':
      hero.play(`${prefix}-wink-hold`);
      break;
    case 'serious':
      hero.play(`${prefix}-serious-hold`);
      break;
    case 'blink':
      hero.play(`${prefix}-blink-loop`);
      break;
    case 'surprised':
      hero.play(`${prefix}-surprised-hold`);
      break;
    case 'victory':
      hero.play(`${prefix}-victory-bounce`);
      break;
    default:
      hero.play(`${prefix}-idle-hold`);
      break;
  }
}

export function raminLipPoint(hero: Phaser.GameObjects.Sprite): { x: number; y: number } {
  // Rotate the mouth offset with the hero; a plain x/y offset drifts off the face.
  return rotatedOffsetPoint(
    hero.x,
    hero.y,
    hero.displayWidth * LIP_X_RATIO,
    hero.displayHeight *
      ((hero.getData('character') === 'borhan' ? BORHAN_LIP_SOURCE_Y : RAMIN_LIP_SOURCE_Y) /
        RAMIN_FRAME_HEIGHT -
        0.5),
    hero.rotation,
  );
}
