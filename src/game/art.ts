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

/** Large shapes, distinct trunks, overlapping crowns and a floor-level trail
 * establish a readable woodland silhouette even on a narrow phone screen.
 * All noise is deterministic, drawn once in Boot, and carries no hit geometry.
 */
function distantPine(
  c: Ctx,
  x: number,
  base: number,
  height: number,
  halfWidth: number,
  colors: readonly [string, string, string],
) {
  const tip = base - height;
  rect(c, x - 3, tip + height * 0.4, 6, height * 0.64, colors[2]);
  for (let step = 0; step < 10; step++) {
    const y = tip + step * height * 0.072;
    const width = halfWidth * (0.2 + step * 0.086);
    rect(c, x - width, y, width * 2, 7 + height * 0.022, colors[0]);
    if (step > 3 && step % 2 === 0) {
      rect(c, x - width + 3, y + 2, width * 0.53, 2, colors[1]);
    }
  }
}

function paintForest(c: Ctx, width: number, height: number, seed: number) {
  const r = rand(seed);
  const tall = height > width;
  const horizon = tall ? 299 : 162;
  const ground = tall ? 335 : 193;
  const openingX = width * (tall ? 0.54 : 0.52);

  // An emerald interior instead of open mountain scenery. A warm clearing
  // behind the target separates the hero from the overlapping tree silhouettes.
  const sky = c.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#102433');
  sky.addColorStop(0.32, '#21464c');
  sky.addColorStop(0.64, '#376355');
  sky.addColorStop(1, '#172e32');
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);
  const glow = c.createRadialGradient(
    openingX,
    horizon - 70,
    8,
    openingX,
    horizon - 70,
    tall ? 156 : 168,
  );
  glow.addColorStop(0, 'rgba(238,205,128,0.36)');
  glow.addColorStop(0.42, 'rgba(148,189,133,0.16)');
  glow.addColorStop(1, 'rgba(148,189,133,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, width, height);

  // Sunbeams pass between high branches and are cut by the tree silhouettes.
  for (let i = 0; i < 7; i++) {
    const center = openingX - 90 + i * 29;
    c.fillStyle = i % 2 ? '#d9d7a010' : '#edf0b80c';
    c.beginPath();
    c.moveTo(center, 0);
    c.lineTo(center + 12, 0);
    c.lineTo(center + 34 + i * 3, ground);
    c.lineTo(center - 11 + i * 3, ground);
    c.fill();
  }

  // Three parallax-like layers: slender distant conifers, leafy midground,
  // and giant outer trunks. The center remains the brightest playable zone.
  const far = ['#244a4c', '#32675b', '#294b4c'] as const;
  for (let layer = 0; layer < 3; layer++) {
    const dark: [string, string, string][] = [
      ['#24454c', '#39605a', '#1d363e'],
      ['#1a4144', '#386b56', '#1b3736'],
      ['#133a37', '#2e684b', '#18322f'],
    ];
    const count = tall ? 13 : 23;
    const stride = width / (count - 1);
    for (let i = 0; i < count; i++) {
      const x = i * stride - 12 + r() * 21;
      const base = horizon + 13 + layer * 12 + r() * 28;
      const size = (tall ? 112 : 87) + layer * (tall ? 23 : 16) + r() * 35;
      distantPine(c, x, base, size, (tall ? 24 : 21) + layer * 6, dark[layer]);
    }
    // Broadleaf crowns distinguish the scene from a mountain pine silhouette.
    for (let i = 0; i < (tall ? 9 : 17); i++) {
      const x = i * (width / (tall ? 8 : 16)) - 9 + r() * 18;
      const y = horizon - 57 - layer * 8 - r() * 35;
      ellipse(c, x, y, 22 + layer * 7 + r() * 15, 19 + r() * 13, far[layer]);
      ellipse(c, x + 13, y - 6, 17 + r() * 11, 14 + r() * 10, dark[layer][1]);
    }
  }

  // Understory and an unmistakably wooded floor. A winding mossy path points
  // inward toward the clearing, while staying strictly behind every hit target.
  rect(c, 0, ground - 4, width, height - ground + 4, '#15362f');
  for (let i = 0; i < 12; i++) {
    const x = (i * width) / 11 - 20;
    ellipse(
      c,
      x,
      ground + 6 + r() * 19,
      30 + r() * 27,
      17 + r() * 10,
      i % 2 ? '#20503b' : '#275541',
    );
  }
  c.fillStyle = '#50684a';
  c.beginPath();
  c.moveTo(openingX - 12, ground - 1);
  c.lineTo(openingX + 9, ground - 1);
  c.bezierCurveTo(openingX - 6, ground + 33, openingX + 42, height - 26, openingX + 59, height);
  c.lineTo(openingX - 74, height);
  c.bezierCurveTo(
    openingX - 33,
    height - 35,
    openingX - 24,
    ground + 25,
    openingX - 12,
    ground - 1,
  );
  c.fill();
  for (let i = 0; i < 55; i++) {
    const x = openingX - 60 + r() * 120;
    const y = ground + r() * (height - ground);
    rect(c, x, y, 2 + r() * 8, 1 + r() * 3, i % 3 === 0 ? '#9c9962' : '#68805b');
  }

  // Towering dark trunks and lateral boughs frame the clearing from both
  // sides; the gameplay trees still provide all of the real occlusion.
  for (const side of [0, 1]) {
    for (let j = 0; j < 3; j++) {
      const x = side === 0 ? -18 + j * 18 : width + 8 - j * 18;
      const trunkWidth = 13 + j * 3;
      rect(c, x, -12, trunkWidth, ground + 31, '#132d2e');
      rect(c, x + 3, 0, 4, ground - 6, '#32534a');
      for (let k = 0; k < 5; k++) {
        const y = 34 + k * 40 + r() * 19;
        const reach = 17 + r() * 40;
        const bx = side === 0 ? x + trunkWidth : x - reach;
        rect(c, bx, y, reach, 4 + r() * 4, '#183835');
        ellipse(c, side === 0 ? bx + reach : bx, y - 4, 23 + r() * 17, 14 + r() * 11, '#164036');
        ellipse(c, side === 0 ? bx + reach + 4 : bx - 4, y - 9, 15, 8, '#285b46');
      }
      for (let k = 0; k < 3; k++) {
        const rootY = ground + k * 7;
        const spread = 15 + k * 9;
        rect(c, x - spread / 2, rootY, trunkWidth + spread, 5, '#153a34');
      }
    }
  }

  // A continuous canopy roof, with leaves, hanging creepers and broken
  // highlights, is the strongest jungle cue and survives mobile cropping.
  for (let x = -26; x < width + 36; x += 22) {
    const crown = 17 + r() * 29;
    ellipse(c, x, 2 + r() * 5, 26 + r() * 15, crown, '#102f31');
    ellipse(c, x + 9, -5, 17 + r() * 10, crown * 0.7, '#215140');
    ellipse(c, x + 4, crown * 0.39, 12 + r() * 8, 10 + r() * 8, '#2c6548');
    for (let j = 0; j < 4; j++) {
      rect(c, x - 16 + r() * 36, 8 + r() * crown, 3 + r() * 5, 2, '#4b8156');
    }
  }
  for (let i = 0; i < (tall ? 18 : 29); i++) {
    const x = 3 + r() * (width - 6);
    const vineLength = 13 + r() * (tall ? 85 : 54);
    rect(c, x, 0, 2, vineLength, '#244e3e');
    for (let y = 12; y < vineLength; y += 14) {
      rect(c, x - 7, y, 7, 3, '#3c8153');
      rect(c, x + 2, y - 5, 7, 3, '#37744b');
    }
  }

  // Fern fronds and bright mushrooms make the ground read at 2x pixel scale.
  for (let i = 0; i < (tall ? 60 : 90); i++) {
    const x = r() * width;
    const y = ground + 9 + r() * Math.max(1, height - ground - 13);
    const h = 8 + r() * 17;
    rect(c, x, y - h, 2, h, '#2d754f');
    for (let k = 0; k < 4; k++) {
      rect(c, x - 6 - k, y - h + k * 4, 7 + k, 2, '#3d8756');
      rect(c, x + 2, y - h + k * 4 + 2, 7 + k, 2, '#285e47');
    }
  }
  for (let i = 0; i < (tall ? 25 : 32); i++) {
    const x = 8 + r() * (width - 16);
    const y = ground + 12 + r() * Math.max(1, height - ground - 20);
    rect(c, x, y - 5, 3, 7, '#b8bb8d');
    ellipse(c, x + 1, y - 6, 6, 3, i % 3 ? '#c48ec8' : '#e9b775');
    rect(c, x - 1, y - 8, 3, 1, '#ffe5b1');
  }
  for (let i = 0; i < (tall ? 38 : 54); i++) {
    const x = r() * width;
    const y = 70 + r() * (ground - 85);
    rect(c, x, y, 2, 2, i % 3 ? '#a5d78699' : '#f9df9c99');
  }
}

function forestBackground(c: Ctx) {
  paintForest(c, SW, SH, 7005);
}

function forestPortrait(c: Ctx) {
  paintForest(c, 270, 480, 9705);
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

/** Academic accessories stay away from Mammad's upper-lip target.
 * Keep his mortarboard visible: don't place Ramin's crown on top of it.
 */
function mammadAccessory(c: Ctx, variant: RaminVariant): void {
  if (variant === 'headband') {
    // A bright ribbon across the graduation cap, not the eyebrows.
    rect(c, 52, 38, 112, 8, '#a42767');
    rect(c, 55, 39, 105, 5, '#ff459b');
    rect(c, 57, 39, 99, 2, '#ffc0dc');
    return;
  }
  if (variant === 'gold') {
    // Honor tassel / cap pin; the face and aiming lane remain untouched.
    rect(c, 156, 37, 9, 9, '#bf852e');
    rect(c, 158, 39, 5, 5, '#ffe39c');
    rect(c, 172, 62, 6, 18, '#d8a342');
    rect(c, 173, 64, 3, 13, '#fff0b4');
    return;
  }
  raminAccessory(c, variant);
}

/** Three mustaches inspired by Borhan's original horseshoe silhouette.
 * The game retains the same three style indices and projectile hit logic.
 */
function borhanMustache(c: Ctx, style: number, golden = false): void {
  const models = [
    { halfWidth: 25, body: 6, drop: 8 },
    { halfWidth: 30, body: 8, drop: 15 },
    { halfWidth: 33, body: 10, drop: 21 },
  ] as const;
  const model = models[style];
  if (!model) throw new RangeError('Unknown Borhan mustache style');
  const shades = golden ? ['#765018', '#c78b27', '#ffe9a2'] : ['#211411', '#4c2d20', '#956249'];
  for (let x = 2; x < MUSTACHE_WIDTH - 2; x++) {
    const t = Math.abs(x - 35.5) / model.halfWidth;
    if (t > 1) continue;
    const top = Math.round(9 + 5 * t);
    const thickness = model.body + 2 * (1 - t);
    const leg = model.drop * Math.pow(Math.max(0, (t - 0.45) / 0.55), 1.35);
    const bottom = Math.min(MUSTACHE_HEIGHT - 2, Math.round(top + thickness + leg));
    for (let y = top; y <= bottom; y++) {
      const border = y === top || y === bottom || t > 0.96;
      const shine = !border && y <= top + 2 && (x + y) % 8 !== 0;
      rect(c, x, y, 1, 1, shades[border ? 0 : shine ? 2 : 1]);
    }
  }
}

/** Borhan's eyes are 8px higher and slightly narrower than Ramin's.
 * Preserve the old Ramin overlays and transform only the Borhan glasses.
 */
function borhanAccessory(c: Ctx, variant: RaminVariant): void {
  if (variant !== 'round' && variant !== 'sunglasses') {
    raminAccessory(c, variant);
    return;
  }
  const scratch = document.createElement('canvas');
  scratch.width = 210;
  scratch.height = 362;
  const source = scratch.getContext('2d');
  if (!source) throw new Error('Cannot draw Borhan accessory');
  source.imageSmoothingEnabled = false;
  raminAccessory(source, variant);
  c.save();
  c.imageSmoothingEnabled = false;
  c.translate(105, 102);
  c.scale(0.9, 0.88);
  c.translate(-105, -110);
  c.drawImage(scratch, 0, 0);
  c.restore();
}

function mustache(c: Ctx, style: number, golden = false) {
  const pixels = decodeMustache(style);
  const shades = golden
    ? ['', '#755016', '#d6a02f', '#ffe58b']
    : ['', '#1c1921', '#54494e', '#807476'];
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
  makeCanvas(scene, 'forest-portrait', 270, 480, forestPortrait);
  for (const variant of RAMIN_VARIANTS) {
    makeCanvas(scene, `ramin-acc-${variant}`, 210, 362, (ctx) => raminAccessory(ctx, variant));
    makeCanvas(scene, `borhan-acc-${variant}`, 210, 362, (ctx) => borhanAccessory(ctx, variant));
    makeCanvas(scene, `mammad-acc-${variant}`, 210, 362, (ctx) => mammadAccessory(ctx, variant));
  }
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
  for (let style = 0; style < 3; style++)
    makeCanvas(scene, `borhan-stache-${style}`, MUSTACHE_WIDTH, MUSTACHE_HEIGHT, (ctx) =>
      borhanMustache(ctx, style),
    );
  makeCanvas(scene, 'borhan-stache-gold', MUSTACHE_WIDTH, MUSTACHE_HEIGHT, (ctx) =>
    borhanMustache(ctx, 1, true),
  );
  makeCanvas(scene, 'stache-gold', MUSTACHE_WIDTH, MUSTACHE_HEIGHT, (ctx) =>
    mustache(ctx, 2, true),
  );
}
