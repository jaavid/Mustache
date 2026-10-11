import Phaser from 'phaser';
import { decodeMustache, MUSTACHE_WIDTH, MUSTACHE_HEIGHT } from '../logic/mustachePixels';
import { RAMIN_VARIANTS, type RaminVariant } from '../logic/variety';

type Ctx = CanvasRenderingContext2D;
const SW = 480;
const SH = 270;

function makeCanvas(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: Ctx) => void,
) {
  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) throw new Error(`Canvas texture creation failed: ${key}`);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  tex.refresh();
}
function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  c.fill();
}
function rand(seed: number) {
  let v = seed >>> 0;
  return () => {
    v = (1664525 * v + 1013904223) >>> 0;
    return v / 4294967296;
  };
}

function forestBackground(c: Ctx) {
  const r = rand(7005);
  const sky = c.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, '#18263f');
  sky.addColorStop(0.45, '#465580');
  sky.addColorStop(0.75, '#8973a5');
  sky.addColorStop(1, '#4a617e');
  c.fillStyle = sky;
  c.fillRect(0, 0, SW, SH);
  // Dawn reflected beyond an ancient forest.
  ellipse(c, 250, 92, 97, 71, '#c4a3a050');
  ellipse(c, 248, 80, 54, 37, '#f4c7a850');
  ellipse(c, 273, 72, 16, 16, '#f4dab0');
  ellipse(c, 279, 66, 14, 14, '#465580');
  for (let i = 0; i < 80; i++)
    rect(c, r() * 480, r() * 130, r() * 2 + 1, r() * 2 + 1, r() > 0.5 ? '#b8d5bd66' : '#ffffff42');
  // Many layers of vertical tree silhouettes, read as parallax depth.
  for (let layer = 0; layer < 3; layer++) {
    const trunk = ['#34445c', '#2b4652', '#213b47'][layer];
    const canopy = ['#344c65', '#2c505a', '#21484b'][layer];
    for (let j = 0; j < 18; j++) {
      const x = j * 31 - 22 + r() * 19;
      const top = 10 + r() * 60 + layer * 15;
      rect(c, x, top, 5 + layer * 3, 195, trunk);
      rect(c, x - 7, top + 34, 16, 3, trunk);
      ellipse(c, x, top, 25 + layer * 4, 24 + layer * 3, canopy);
      ellipse(c, x - 14, top + 14, 21, 16, canopy);
      ellipse(c, x + 11, top + 15, 19, 22, canopy);
    }
  }
  // Mountain valley and waterfalls.
  c.fillStyle = '#52667b';
  c.beginPath();
  c.moveTo(0, 171);
  c.lineTo(57, 132);
  c.lineTo(108, 158);
  c.lineTo(159, 117);
  c.lineTo(226, 152);
  c.lineTo(311, 121);
  c.lineTo(384, 144);
  c.lineTo(480, 104);
  c.lineTo(480, 220);
  c.lineTo(0, 220);
  c.closePath();
  c.fill();
  c.fillStyle = '#324f55';
  c.beginPath();
  c.moveTo(0, 179);
  c.lineTo(68, 150);
  c.lineTo(125, 172);
  c.lineTo(195, 145);
  c.lineTo(271, 164);
  c.lineTo(352, 135);
  c.lineTo(480, 173);
  c.lineTo(480, 235);
  c.lineTo(0, 235);
  c.closePath();
  c.fill();
  rect(c, 390, 124, 23, 110, '#88cad0');
  rect(c, 394, 127, 4, 105, '#bfe6dd');
  rect(c, 404, 124, 2, 116, '#c9edeb');
  for (let i = 0; i < 30; i++) rect(c, 385 + r() * 40, 227 + r() * 16, 2 + r() * 5, 1, '#d3ddd188');
  rect(c, 0, 179, 480, 91, '#253f3f');
  // Ruined mossy bridge behind stage.
  rect(c, 320, 140, 140, 7, '#6d665f');
  rect(c, 318, 143, 144, 4, '#3b434d');
  for (let x = 330; x < 463; x += 20) {
    rect(c, x, 129, 4, 17, '#55535c');
    rect(c, x + 4, 133, 16, 3, '#8a7e78');
  }
  // Lush ground blocks with exposed rocky edge.
  rect(c, 0, 188, 480, 82, '#233e37');
  for (let i = 0; i < 110; i++) {
    let x = Math.floor(r() * 480),
      y = 184 + Math.floor(r() * 56);
    rect(
      c,
      x,
      y,
      2 + Math.floor(r() * 9),
      1 + Math.floor(r() * 4),
      ['#375c44', '#2b5a4b', '#47664d', '#566d4f'][Math.floor(r() * 4)],
    );
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(r() * 480),
      y = 233 + Math.floor(r() * 36);
    rect(c, x, y, 3 + Math.floor(r() * 12), 2 + Math.floor(r() * 6), '#1b3335');
  }
  // Moss covered stepping stones and glowing mushrooms.
  for (let i = 0; i < 15; i++) {
    const x = Math.floor(r() * 480),
      y = 217 + Math.floor(r() * 51);
    ellipse(c, x, y, 8 + r() * 8, 3 + r() * 3, '#526b5a');
    rect(c, x - 5, y - 2, 8, 2, '#7e8965');
  }
  for (let i = 0; i < 28; i++) {
    const x = Math.floor(r() * 470) + 4,
      y = Math.floor(200 + r() * 58);
    rect(c, x, y - 2, 2, 5, '#c9c8a2');
    ellipse(c, x + 1, y - 3, 5, 3, r() > 0.55 ? '#c875e4' : '#a8a0ff');
    rect(c, x, y - 4, 2, 1, '#ffdcfa');
  }
  // Hanging drapery of canopy: strong top framing.
  for (let x = -22; x < 500; x += 13) {
    const len = 8 + Math.floor(r() * 36);
    ellipse(c, x, 0, 24, len, '#112f35');
    ellipse(c, x + 6, 4, 18, len * 0.6, '#17473c');
    for (let j = 0; j < 4; j++) rect(c, x - 9 + r() * 24, 7 + r() * len, 3, 3, '#286048');
  }
  // Side vignettes, no dependency on external assets.
  for (const x of [-7, 470]) {
    rect(c, x, 0, 14, 210, '#1a303b');
    rect(c, x + 3, 0, 4, 200, '#3a4a47');
  }
  // Back fireflies
  for (let i = 0; i < 52; i++) {
    const x = Math.floor(r() * 480),
      y = Math.floor(r() * 210);
    rect(c, x, y, 2, 2, i % 3 === 0 ? '#f7dc86' : '#73d7a377');
  }
}

/**
 * Each spawn tree is split into independently layered textures:
 * a low-depth crown / rear branches, and a high-depth bark occluder.
 * Keep the upper-lip lane completely free of hanging lanterns or other props.
 * Shared canvas size and trunk axis (x=48) guarantee perfect layer alignment.
 */
function treeBack(c: Ctx, variant: number) {
  const r = rand(6061 + variant * 97);
  const canopy = [
    ['#193d3f', '#275349', '#35654d', '#467755'],
    ['#183c47', '#285359', '#32645e', '#4b7b65'],
    ['#263d46', '#335552', '#41675a', '#577c59'],
  ][variant];
  // Wide but cropped-at-top leafy crown, growing out of the trunk.
  for (let i = 0; i < 52; i++) {
    const px = 8 + r() * 82;
    const py = 2 + r() * 76;
    const rad = 8 + r() * 16;
    ellipse(c, px, py, rad, 7 + r() * 12, canopy[(i + Math.floor(r() * 3)) % 4]);
  }
  // Pixel stepped edge and brighter clustered foliage; no hanging ornaments.
  for (let i = 0; i < 65; i++) {
    const px = r() * 96,
      py = r() * 72;
    if (Math.pow((px - 48) / 52, 2) + Math.pow((py - 26) / 55, 2) > 1.3) continue;
    rect(c, px, py, 3 + r() * 7, 2 + r() * 5, canopy[1 + Math.floor(r() * 3)]);
  }
  // Branches are background objects: Ramin's face draws in front of them.
  rect(c, 20, 55, 55, 6, '#463c38');
  rect(c, 23, 51, 7, 5, '#5c5040');
  rect(c, 58, 60, 25, 6, '#4c4039');
  rect(c, 61, 57, 7, 4, '#6a5441');
  for (let i = 0; i < 24; i++) {
    const x = 15 + r() * 72,
      y = 20 + r() * 55;
    if (i % 4 === 0) rect(c, x, y, 3, 2, '#80a469');
  }
}

function treeFront(c: Ctx, variant: number) {
  const r = rand(1737 + variant * 83);
  const bark = [
    ['#201f2e', '#4f3b34', '#79553c', '#a47449'],
    ['#1c2930', '#4a443a', '#746148', '#a18a5a'],
    ['#252b2f', '#544337', '#826044', '#ad8054'],
  ][variant];
  // High-contrast trunk with a persistent, clear silhouette at all Y positions.
  // The trunk alone occludes the character, not foliage or a lamp.
  rect(c, 33, 38, 31, 159, bark[0]);
  rect(c, 36, 34, 27, 163, bark[1]);
  rect(c, 41, 29, 18, 168, bark[2]);
  rect(c, 44, 31, 6, 160, bark[3]);
  rect(c, 58, 39, 4, 154, bark[0]);
  rect(c, 35, 54, 4, 119, bark[0]);
  // Forked bark near the canopy, kept close to the actual trunk axis.
  rect(c, 34, 27, 10, 21, bark[1]);
  rect(c, 56, 23, 8, 30, bark[1]);
  rect(c, 31, 35, 6, 20, bark[0]);
  rect(c, 62, 28, 5, 22, bark[0]);
  // Highly legible bark striations; independent variation per tree.
  for (let i = 0; i < 54; i++) {
    const x = 38 + r() * 21,
      y = 51 + r() * 132;
    rect(
      c,
      x,
      y,
      1 + r() * 3,
      3 + r() * 13,
      i % 4 === 0 ? bark[3] : i % 3 === 0 ? bark[0] : bark[1],
    );
  }
  // Moss is embedded in the bark, not a separate foreground prop.
  for (let i = 0; i < 20; i++) {
    const x = 36 + r() * 23,
      y = 84 + r() * 105;
    rect(c, x, y, 2 + r() * 3, 1 + r() * 3, i % 2 === 0 ? '#42664a' : '#6e8653');
  }
  // Wide root flare at the bottom. No loose decoration near face/aim point.
  rect(c, 28, 179, 43, 17, bark[1]);
  rect(c, 19, 191, 56, 9, bark[0]);
  rect(c, 11, 197, 74, 8, bark[1]);
  rect(c, 21, 197, 58, 7, bark[2]);
  rect(c, 33, 192, 31, 10, bark[3]);
  rect(c, 8, 204, 82, 4, '#203d35');
  rect(c, 18, 202, 59, 4, '#496b4b');
  for (let i = 0; i < 18; i++) {
    const x = 14 + r() * 70,
      y = 198 + r() * 11;
    rect(c, x, y, 2 + r() * 4, 1 + r() * 2, i % 2 === 0 ? '#3c7651' : '#668b51');
  }
}

/** Pixel overlays share the Ramin sheet's 210×362 frame and do not touch his lip at y=136. */
/** Emotion overlays match the 210x362 Ramin sheet; every pixel stays above the lip. */
function raminEmoteHand(c: Ctx) {
  // Cartoon palm, cuff and a finger pointing toward the glued mustache.
  rect(c, 5, 22, 18, 12, '#151c2a');
  rect(c, 7, 23, 16, 6, '#61708e');
  rect(c, 9, 11, 20, 17, '#b97559');
  rect(c, 11, 10, 17, 17, '#f0b48d');
  rect(c, 4, 14, 9, 8, '#df9976');
  rect(c, 18, 3, 7, 15, '#e7a783');
  rect(c, 20, 2, 5, 11, '#ffd3a5');
  rect(c, 12, 12, 4, 12, '#ffe0b4');
  rect(c, 9, 23, 18, 4, '#ae745a');
}

function raminAccessory(c: Ctx, variant: RaminVariant) {
  if (variant === 'normal') return;
  if (variant === 'sunglasses') {
    // Strongly recognizable dark frames with lavender/blue reflections.
    rect(c, 63, 101, 41, 7, '#171322');
    rect(c, 107, 101, 40, 7, '#171322');
    rect(c, 65, 104, 40, 18, '#1b1826');
    rect(c, 107, 104, 38, 18, '#1b1826');
    rect(c, 69, 108, 32, 11, '#3b3156');
    rect(c, 111, 108, 30, 11, '#323e63');
    rect(c, 72, 108, 12, 3, '#8972a3');
    rect(c, 114, 108, 12, 3, '#6b8eb8');
    rect(c, 101, 107, 9, 4, '#18121c');
    rect(c, 59, 106, 9, 6, '#18121c');
    rect(c, 143, 106, 8, 6, '#18121c');
    rect(c, 74, 120, 22, 3, '#18121c');
    rect(c, 117, 120, 21, 3, '#18121c');
    return;
  }
  if (variant === 'round') {
    // Retro round spectacles with translucent lenses.
    for (const center of [85, 125]) {
      const x = center - 17;
      rect(c, x + 7, 94, 20, 3, '#171a28');
      rect(c, x + 3, 97, 28, 3, '#272637');
      rect(c, x, 101, 5, 17, '#282638');
      rect(c, x + 29, 101, 5, 17, '#282638');
      rect(c, x + 4, 118, 27, 4, '#282638');
      rect(c, x + 7, 121, 20, 3, '#171a28');
      rect(c, x + 5, 102, 24, 15, '#8bc1bd26');
      rect(c, x + 7, 103, 4, 8, '#d6f3df');
    }
    rect(c, 102, 104, 6, 3, '#252330');
    rect(c, 58, 106, 13, 3, '#24212f');
    rect(c, 141, 106, 11, 3, '#24212f');
    return;
  }
  if (variant === 'headband') {
    // High-contrast neon-pink pixel bandana. Broad sash and two distinct
    // trailing ribbons make it readable even when the mobile canvas is scaled.
    // All cloth stays above/aside from the 136px upper-lip aim point.
    rect(c, 56, 78, 100, 17, '#442339');
    rect(c, 59, 79, 95, 13, '#ff459b');
    rect(c, 61, 81, 90, 5, '#ffc0dc');
    rect(c, 61, 88, 91, 4, '#d81e77');
    rect(c, 88, 79, 22, 12, '#ff8bc1');
    rect(c, 94, 83, 8, 5, '#ffe2ef');
    // Readable knot on the right temple and wind-blown scarf tips.
    rect(c, 149, 77, 15, 19, '#6f2656');
    rect(c, 152, 79, 10, 14, '#ff459b');
    rect(c, 158, 86, 19, 8, '#ff459b');
    rect(c, 165, 89, 15, 10, '#d81e77');
    rect(c, 173, 93, 9, 7, '#ffc0dc');
    rect(c, 157, 96, 10, 23, '#602043');
    rect(c, 160, 98, 8, 24, '#ff459b');
    rect(c, 164, 113, 7, 8, '#ffc0dc');
    return;
  }
  // Rare golden crown with glints outside the facial aiming area.
  rect(c, 73, 38, 66, 12, '#9b612b');
  rect(c, 74, 25, 12, 21, '#f5be62');
  rect(c, 101, 17, 12, 29, '#ffe297');
  rect(c, 128, 24, 12, 22, '#f5be62');
  rect(c, 77, 40, 60, 8, '#fff0ae');
  rect(c, 90, 42, 8, 5, '#c77bea');
  rect(c, 116, 42, 8, 5, '#8ee3df');
  rect(c, 54, 62, 5, 12, '#f0bd6b');
  rect(c, 50, 66, 13, 4, '#f0bd6b');
  rect(c, 150, 58, 4, 10, '#f7d58c');
  rect(c, 146, 62, 12, 4, '#f7d58c');
}

function mustache(c: Ctx, style: number, golden = false) {
  const pixels = decodeMustache(style);
  const shades = golden ? ['', '#755016', '#d6a02f', '#ffe58b'] : ['', '#1c1921', '#54494e', '#807476'];
  for (let y = 0; y < MUSTACHE_HEIGHT; y++)
    for (let x = 0; x < MUSTACHE_WIDTH; x++) {
      const shade = pixels[y * MUSTACHE_WIDTH + x];
      if (shade) rect(c, x, y, 1, 1, shades[shade]);
    }
}
function icon(c: Ctx) {
  ellipse(c, 20, 20, 19, 19, '#8a551c');
  ellipse(c, 20, 19, 17, 17, '#ffc450');
  ellipse(c, 20, 19, 13, 13, '#d79a32');
  c.strokeStyle = '#ffefad';
  c.lineWidth = 2;
  c.strokeRect(10, 11, 20, 15);
  rect(c, 12, 14, 4, 10, '#fff0b3');
  rect(c, 16, 14, 4, 3, '#fff0b3');
  rect(c, 19, 18, 3, 3, '#fff0b3');
  rect(c, 24, 13, 4, 10, '#fff0b3');
}
/** Transparent textures add convincing depth without increasing sprite sheet downloads. */
function mist(c: Ctx) {
  const r = rand(178);
  for (let i = 0; i < 44; i++) {
    const x = r() * 480,
      y = 18 + r() * 66;
    ellipse(c, x, y, 32 + r() * 77, 4 + r() * 13, i % 2 === 0 ? '#9ac3c720' : '#d7cce01a');
    rect(c, x - 18, y, 28 + r() * 60, 2, '#a8cbd311');
  }
}
function forestFront(c: Ctx) {
  const r = rand(202610);
  // Empty transparent pixels above the fern line keep the target's upper lip visible.
  for (let i = 0; i < 92; i++) {
    const x = r() * 480,
      y = 34 + r() * 40;
    const h = 9 + r() * 27;
    rect(c, x, y - h, 2, h, i % 2 ? '#163d37' : '#1d5644');
    for (let j = 0; j < 5; j++) {
      const yy = y - 5 - j * 5;
      rect(c, x - 4 - (j % 2) * 2, yy, 6, 2, '#27664a');
      rect(c, x + 2, yy - 2, 5 + (j % 2) * 2, 2, '#35815b');
    }
  }
  for (let i = 0; i < 110; i++) {
    const x = r() * 480,
      y = 42 + r() * 34;
    ellipse(
      c,
      x,
      y,
      6 + r() * 12,
      3 + r() * 5,
      i % 3 === 0 ? '#164a3a' : i % 3 === 1 ? '#255e45' : '#1b453b',
    );
  }
  for (let i = 0; i < 22; i++) {
    const x = r() * 480,
      y = 46 + r() * 25;
    rect(c, x, y - 4, 2, 7, '#b4b399');
    ellipse(c, x + 1, y - 5, 5, 3, i % 2 ? '#9d6cd6' : '#ffba71');
    rect(c, x, y - 7, 2, 1, '#fff1c7');
  }
}
function leaf(c: Ctx, style: number) {
  rect(c, 3, 0, 2, 2, style === 0 ? '#acd671' : style === 1 ? '#d7a85e' : '#77b79e');
  rect(c, 1, 2, 6, 3, style === 0 ? '#4f9c68' : style === 1 ? '#c17b4f' : '#65a3bd');
  rect(c, 2, 5, 4, 2, style === 0 ? '#27694e' : style === 1 ? '#976345' : '#3e719b');
  rect(c, 4, 3, 1, 6, '#31533f');
}
function spark(c: Ctx) {
  rect(c, 3, 0, 2, 8, '#ffffff');
  rect(c, 0, 3, 8, 2, '#ffffff');
  rect(c, 2, 2, 4, 4, '#ffedab');
}
function butterfly(c: Ctx) {
  rect(c, 6, 6, 2, 8, '#271e46');
  rect(c, 1, 3, 6, 6, '#be91ee');
  rect(c, 9, 3, 6, 6, '#be91ee');
  rect(c, 3, 9, 4, 5, '#7ca9d7');
  rect(c, 9, 9, 4, 5, '#7ca9d7');
  rect(c, 4, 5, 2, 2, '#ffecb4');
  rect(c, 10, 5, 2, 2, '#ffecb4');
}

export function createArt(scene: Phaser.Scene) {
  makeCanvas(scene, 'forest', SW, SH, forestBackground);
  for (let i = 0; i < 3; i++) {
    makeCanvas(scene, `tree-back-${i}`, 96, 220, (ctx) => treeBack(ctx, i));
    makeCanvas(scene, `tree-front-${i}`, 96, 220, (ctx) => treeFront(ctx, i));
  }
  for (const variant of RAMIN_VARIANTS)
    makeCanvas(scene, `ramin-acc-${variant}`, 210, 362, (ctx) => raminAccessory(ctx, variant));
  makeCanvas(scene, 'ramin-emote-hand', 35, 40, raminEmoteHand);
  makeCanvas(scene, 'mist', 480, 90, mist);
  makeCanvas(scene, 'forest-front', 480, 80, forestFront);
  makeCanvas(scene, 'spark', 8, 8, spark);
  makeCanvas(scene, 'butterfly', 16, 16, butterfly);
  for (let i = 0; i < 3; i++) makeCanvas(scene, `leaf-${i}`, 8, 10, (ctx) => leaf(ctx, i));
  makeCanvas(scene, 'coin', 40, 40, icon);
  for (let style = 0; style < 3; style++)
    makeCanvas(scene, `stache-${style}`, MUSTACHE_WIDTH, MUSTACHE_HEIGHT, (ctx) =>
      mustache(ctx, style),
    );
  makeCanvas(scene, 'stache-gold', MUSTACHE_WIDTH, MUSTACHE_HEIGHT, (ctx) => mustache(ctx, 2, true));
}
