import Phaser from 'phaser';
import { burstLeaves, burstStars } from './ambience';
import { addSoundToggle, playSfx } from './sound';
import { addMusicToggle, startMusic, stopMusic } from './sound';
import { addPauseButton, beginTutorial, registerRoundVisibility } from './overlays';
import {
  emptyStats,
  summarizeRound,
  type RoundStats,
  type RoundSummary,
} from '../logic/roundStats';
import { haptic } from './haptics';
import {
  addArcadeAccents,
  addLivingForest,
  addPhaseHud,
  addMissionStrip,
  announcePhase,
  celebrateCombo,
  impactRing,
  raminMoment,
  rarePerfectSlowMo,
} from './arcadeVisuals';
import { tunePopPlan } from '../logic/arcadePhases';
import { setMusicPhase } from './sound';
import { addResultsExtras } from './replayUi';
import { applyRaminMood, makeRamin, RAMIN_MOBILE_SCALE, raminLipPoint } from './ramin';
import { readBestScore, ROUND_LENGTH_SECONDS, saveBestScore } from '../logic/scoring';
import { resolveRoundShot } from '../logic/shotResolution';
import { startCompetitiveRound, recordCompetitiveShot } from '../platform/competitiveScores';
import { accumulateActiveRoundMs } from '../logic/activeRoundClock';
import { nextSlot, popPlan, type PopPlan } from '../logic/gameplay';
import {
  MOBILE_TREE_CENTERS,
  MOBILE_PEEK_DISTANCE,
  chooseSpawnSide,
  peekPosition,
} from '../logic/treeGeometry';
import { enterFromTree, exitBehindTreeWithSlip, hitReaction, launchMustache } from './gameFeel';
import {
  chooseRaminVariant,
  chooseSpawnEvent,
  type RaminVariant,
  type SpawnEvent,
} from '../logic/variety';
import { makeAccessory, selectAccessory, syncAccessory } from './accessories';
import { attachMustache, resolveMissImpact, showLandingPrecision } from './impactFx';
import { toHeroAnchor, fromHeroAnchor, type StickerAnchor } from '../logic/stickerAnchor';
import { RaminMomentController } from './raminMoments';
import { GoldenFlyer } from './goldenFlyer';
import { characterName, mustacheTexture } from './characterChoice';
import { armGoldenForSelection, shouldLaunchGolden } from '../logic/goldenSelection';
import { getSelectedGameMode, setSelectedGameMode } from '../logic/gameMode';
import { addProgressionMenu } from './progressionUi';
import { addGoldVault } from './goldVault';

/** Dedicated 540 × 960 portrait experience. Desktop scenes remain unchanged. */
const W = 540;
const H = 960;
const FONT = '"Courier New", monospace';
const SELECTOR_TOP = 768;
const HUD_BOTTOM = 164;
const FACE_Y = 547;
// Slightly more forgiving hit zones on touchscreens without changing the scoring contract.

function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  words: string,
  size: number,
  color = '#ffffff',
) {
  return scene.add
    .text(x, y, words, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      stroke: '#211c33',
      strokeThickness: 4,
      align: 'center',
    })
    .setOrigin(0.5)
    .setDepth(90);
}

function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = 0x15243a,
  alpha = 0.96,
  depth = 70,
) {
  return scene.add.rectangle(x, y, w, h, fill, alpha).setStrokeStyle(4, 0x745c83).setDepth(depth);
}

function largeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  caption: string,
  onClick: () => void,
) {
  scene.add.rectangle(x + 4, y + 7, 380, 84, 0x111a2b).setDepth(80);
  const surface = scene.add
    .rectangle(x, y, 380, 84, 0x9b6bef)
    .setStrokeStyle(5, 0x463064)
    .setDepth(81)
    .setInteractive({ useHandCursor: true });
  scene.add.rectangle(x, y - 33, 360, 7, 0xdbb3ff, 0.75).setDepth(82);
  text(scene, x, y, caption, 30, '#fff5ff');
  surface.on('pointerdown', onClick);
  return surface;
}

function portraitBackdrop(scene: Phaser.Scene) {
  scene.add.rectangle(W / 2, H / 2, W, H, 0x101b31).setDepth(-45);
  // Crop the existing landscape art instead of stretching it into a portrait texture.
  scene.add
    .image(W / 2, 466, 'forest')
    .setDisplaySize(1300, 735)
    .setDepth(-40);
  scene.add
    .image(W / 2, 798, 'forest')
    .setDisplaySize(1250, 710)
    .setAlpha(0.65)
    .setTint(0x7aa398)
    .setDepth(-39);
  scene.add.rectangle(W / 2, 850, W, 235, 0x122c31, 0.72).setDepth(-10);
  for (let i = 0; i < 20; i++) {
    const x = 23 + ((i * 79) % 500);
    const y = 192 + ((i * 151) % 565);
    const dot = scene.add
      .image(x, y, 'spark')
      .setScale(i % 3 ? 0.7 : 1)
      .setDepth(12)
      .setTint(i % 2 ? 0xffe29b : 0x9ce8b3)
      .setAlpha(0.3);
    scene.tweens.add({
      targets: dot,
      alpha: 0.8,
      y: y - 14,
      duration: 1900 + i * 90,
      yoyo: true,
      repeat: -1,
    });
  }
}

function trees(scene: Phaser.Scene) {
  MOBILE_TREE_CENTERS.forEach((center, index) => {
    const canopy = scene.add
      .image(center, 552, `tree-back-${index}`)
      .setDisplaySize(146, 430)
      .setDepth(14);
    scene.tweens.add({
      targets: canopy,
      angle: index === 1 ? -0.6 : 0.6,
      duration: 2550 + index * 310,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    scene.add.image(center, 552, `tree-front-${index}`).setDisplaySize(146, 430).setDepth(28);
  });
  scene.add.image(270, 748, 'forest-front').setDisplaySize(545, 125).setDepth(40);
}

export class MobileMenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }
  create() {
    portraitBackdrop(this);
    addArcadeAccents(this, true);
    panel(this, 270, 192, 496, 292, 0x122037, 0.91, 45);
    text(this, 270, 79, '✦ N5 ARCADE ✦', 25, '#ffe199');
    text(this, 270, 151, 'MUSTACHE', 52, '#ffce77');
    text(this, 270, 216, 'MAYHEM', 64, '#c5a2ff');
    text(this, 270, 288, 'AIM · SHOOT · STACHE', 20, '#e1dac7');
    const hero = makeRamin(this, 270, 530, RAMIN_MOBILE_SCALE, 'blink').setDepth(43);
    const lip = raminLipPoint(hero);
    const menuStache = this.add
      .image(lip.x, lip.y, mustacheTexture(0))
      .setDisplaySize(80, 44)
      .setDepth(44);
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      const target = raminLipPoint(hero);
      menuStache.setPosition(target.x, target.y).setRotation(hero.rotation);
    });
    this.add.image(451, 390, 'coin').setDisplaySize(70, 70).setDepth(48);
    this.tweens.add({
      targets: hero,
      y: 498,
      duration: 1550,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    text(this, 270, 691, `CATCH ${characterName()} IN THE FOREST!`, 22, '#fbe8bc');
    addSoundToggle(this, 468, 38, 118);
    addMusicToggle(this, 72, 38, 118);
    const start = () => {
      setSelectedGameMode('classic');
      playSfx('start');
      this.scene.start('CharacterSelect');
    };
    largeButton(this, 270, 792, '▶ FOREST', start);
    addProgressionMenu(this, true, () => {
      setSelectedGameMode('goldRush');
      playSfx('start');
      this.scene.start('CharacterSelect');
    });
    // Progression actions replace the previous static menu hints.
    this.input.keyboard?.once('keydown-ENTER', start);
  }
}

export class MobilePlayScene extends Phaser.Scene {
  private score = 0;
  private perfectStreak = 0;
  private roundElapsedMs = 0;
  private scoreRoundStarted = false;
  private combo = 0;
  private remaining = ROUND_LENGTH_SECONDS;
  private selectedStyle = 0;
  private activeTarget = false;
  private shooting = false;
  private roundOver = false;
  private spawnSerial = 0;
  private previousSlot = -1;
  private hero!: Phaser.GameObjects.Sprite;
  private sticker!: Phaser.GameObjects.Image;
  private stickerAnchor: StickerAnchor | null = null;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private selector: Phaser.GameObjects.Rectangle[] = [];
  private styleIcons: Phaser.GameObjects.Image[] = [];
  private styleLabels: Phaser.GameObjects.Text[] = [];
  private goldenArmed = false;
  private currentPlan!: PopPlan;
  private accessory!: Phaser.GameObjects.Image;
  private moments!: RaminMomentController;
  private currentVariant: RaminVariant = 'normal';
  private pendingDouble = false;
  private previousEvent: SpawnEvent = 'normal';
  private stats: RoundStats = { ...emptyStats };
  private golden!: GoldenFlyer;
  private updatePhase!: (elapsed: number) => void;
  private followLighting!: (hero: Phaser.GameObjects.Sprite) => void;
  private updateMissions!: (score: number, perfect: number, combo: number) => void;

  constructor() {
    super('Play');
  }
  create() {
    this.score = 0;
    this.perfectStreak = 0;
    this.roundElapsedMs = 0;
    this.scoreRoundStarted = false;
    this.combo = 0;
    this.remaining = ROUND_LENGTH_SECONDS;
    this.selectedStyle = 0;
    this.goldenArmed = false;
    this.activeTarget = false;
    this.shooting = false;
    this.roundOver = false;
    this.spawnSerial = 0;
    this.previousSlot = -1;
    this.pendingDouble = false;
    this.previousEvent = 'normal';
    this.currentVariant = 'normal';
    this.stats = { ...emptyStats };
    this.stickerAnchor = null;
    portraitBackdrop(this);
    if (getSelectedGameMode() === 'goldRush') addGoldVault(this, true);
    trees(this);
    addArcadeAccents(this, true);
    const lighting = addLivingForest(this, true);
    this.followLighting = lighting.follow;
    const phaseHud = addPhaseHud(this, true, (phase) => {
      lighting.setPhase(phase);
      setMusicPhase(phase);
      announcePhase(this, true, phase);
    });
    this.updatePhase = phaseHud.update;
    this.updateMissions = addMissionStrip(this, true).update;
    this.hero = makeRamin(this, -300, FACE_Y + 18, RAMIN_MOBILE_SCALE, 'idle').setVisible(false);
    this.accessory = makeAccessory(this);
    this.moments = new RaminMomentController(this, this.hero, this.accessory, true);
    this.sticker = this.add
      .image(-300, FACE_Y, mustacheTexture(0, getSelectedGameMode() === 'goldRush'))
      .setDisplaySize(82, 46)
      .setDepth(31)
      .setVisible(false);
    this.hud();
    this.golden = new GoldenFlyer(
      this,
      true,
      (message, color) => this.varietyNotice(message, color),
      (ready) => this.updateGoldenSelector(ready),
      getSelectedGameMode() === 'goldRush',
    );
    addSoundToggle(this, 469, 27, 112);
    addMusicToggle(this, 70, 27, 112);
    addPauseButton(this, 473, 195, true);
    this.styles();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.shoot(pointer));
    this.input.keyboard?.on('keydown-ONE', () => this.chooseStyle(0));
    this.input.keyboard?.on('keydown-TWO', () => this.chooseStyle(1));
    this.input.keyboard?.on('keydown-THREE', () => this.chooseStyle(2));
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.roundOver) return;
        this.remaining--;
        this.updatePhase(ROUND_LENGTH_SECONDS - this.remaining);
        this.timeText.setText(`00:${String(Math.max(0, this.remaining)).padStart(2, '0')}`);
        if (this.remaining <= 10) this.timeText.setColor('#ff929c');
        if (this.remaining <= 0) this.finish();
      },
    });
    const hint = text(this, 270, 295, 'WATCH THE TREES · AIM FOR THE LIP!', 19, '#f5e8bb').setDepth(
      61,
    );
    this.tweens.add({
      targets: hint,
      alpha: 0,
      y: 282,
      duration: 850,
      delay: 1500,
      onComplete: () => hint.destroy(),
    });
    this.time.delayedCall(650, () => this.pop());
    startMusic();
    registerRoundVisibility(this, true);
    beginTutorial(this, true);
  }

  private hud() {
    panel(this, 270, 89, 526, 156, 0x131c2d, 0.97, 75);
    text(this, 270, 26, 'N5 · MUSTACHE MAYHEM', 18, '#f4c66d');
    this.add.image(36, 99, 'coin').setDisplaySize(44, 44).setDepth(86);
    for (const [x, title] of [
      [108, 'SCORE'],
      [270, 'TIME'],
      [430, 'COMBO'],
    ] as const) {
      text(this, x, 73, title, 18, '#d7c9bd');
    }
    this.scoreText = text(this, 108, 115, '00000', 29, '#fff3c2');
    this.timeText = text(this, 270, 115, '00:45', 30, '#ffffff');
    this.comboText = text(this, 430, 115, '× 0', 29, '#ceb0ff');
    text(this, 270, 151, 'TAP THE SPACE UNDER HIS NOSE', 17, '#caeccf');
  }

  private styles() {
    panel(this, 270, 859, 526, 190, 0x111c2e, 0.98, 75);
    text(this, 270, 793, 'CHOOSE YOUR MUSTACHE', 21, '#ffe3a4');
    this.selector = [];
    this.styleIcons = [];
    this.styleLabels = [];
    for (let i = 0; i < 3; i++) {
      const x = 101 + i * 169;
      const hit = this.add
        .rectangle(x, 863, 146, 97, 0x302b48)
        .setStrokeStyle(5, 0x6c6282)
        .setDepth(79)
        .setInteractive({ useHandCursor: true });
      hit.on(
        'pointerdown',
        (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.chooseStyle(i);
          playSfx('select');
          haptic('select');
        },
      );
      this.styleIcons.push(
        this.add
          .image(x, 869, mustacheTexture(i, getSelectedGameMode() === 'goldRush'))
          .setDisplaySize(115, 54)
          .setDepth(80),
      );
      this.styleLabels.push(text(this, x - 53, 833, String(i + 1), 19, '#fff2bb'));
      this.selector.push(hit);
    }
    this.chooseStyle(0);
    text(this, 270, 936, 'TAP THE FACE TO LAUNCH!', 17, '#d2bbff');
  }
  private chooseStyle(i: number) {
    this.selectedStyle = i;
    // Only a deliberate selection AFTER charging equips the special shot.
    // Completing the third pickup never changes an existing style selection.
    this.goldenArmed =
      getSelectedGameMode() === 'classic' && armGoldenForSelection(i, this.golden.ready);
    this.refreshSelector();
  }
  private updateGoldenSelector(ready: boolean) {
    this.goldenArmed = false;
    const icon = this.styleIcons[1];
    this.tweens.killTweensOf(icon);
    icon.setAlpha(1).setTexture(mustacheTexture(1, ready || getSelectedGameMode() === 'goldRush'));
    this.styleLabels[1].setText(ready ? 'GOLD' : '2').setColor(ready ? '#ffe291' : '#fff2bb');
    if (ready) {
      this.tweens.add({ targets: icon, alpha: 0.66, duration: 480, yoyo: true, repeat: -1 });
    }
    this.refreshSelector();
  }
  private refreshSelector() {
    this.selector.forEach((box, index) => {
      const chosen = index === this.selectedStyle;
      const goldSlot = index === 1 && this.golden.ready;
      box
        .setFillStyle(
          goldSlot ? (this.goldenArmed ? 0x705331 : 0x3d3041) : chosen ? 0x594171 : 0x302b48,
        )
        .setStrokeStyle(
          5,
          goldSlot ? (this.goldenArmed ? 0xfff3b7 : 0xe7b747) : chosen ? 0xffd374 : 0x6c6282,
        );
    });
  }
  private pop() {
    if (this.roundOver) return;
    const slot = nextSlot(this.previousSlot, MOBILE_TREE_CENTERS.length, Math.random());
    this.previousSlot = slot;
    const serial = ++this.spawnSerial;
    const fromDouble = this.pendingDouble;
    this.pendingDouble = false;
    const event: SpawnEvent = fromDouble
      ? 'normal'
      : chooseSpawnEvent(
          ROUND_LENGTH_SECONDS - this.remaining,
          this.remaining,
          Math.random(),
          this.previousEvent,
        );
    if (!fromDouble) this.previousEvent = event;
    if (event === 'double') this.pendingDouble = true;
    this.currentVariant = event === 'fake-out' ? 'normal' : chooseRaminVariant(Math.random());
    const plan = tunePopPlan(
      popPlan(ROUND_LENGTH_SECONDS - this.remaining, Math.random()),
      ROUND_LENGTH_SECONDS - this.remaining,
    );
    if (getSelectedGameMode() === 'goldRush') {
      plan.visibleMs = Math.max(850, Math.round(plan.visibleMs * 0.85));
      plan.pauseMs = Math.max(100, Math.round(plan.pauseMs * 0.8));
    }
    plan.side = chooseSpawnSide(slot, MOBILE_TREE_CENTERS.length, plan.side);
    plan.shift = MOBILE_PEEK_DISTANCE;
    if (event === 'fake-out') plan.visibleMs = 350;
    this.currentPlan = plan;
    this.activeTarget = false;
    this.shooting = false;
    const treeX = MOBILE_TREE_CENTERS[slot];
    const x = peekPosition(treeX, plan.side, MOBILE_PEEK_DISTANCE);
    const y = FACE_Y;
    this.moments.clear();
    this.stickerAnchor = null;
    applyRaminMood(this.hero, 'idle');
    this.sticker.setVisible(false);
    selectAccessory(this.accessory, this.currentVariant);
    burstLeaves(this, treeX, 650, 8);
    if (fromDouble) this.varietyNotice('AGAIN!', '#ffdd82');
    else if (event === 'double') this.varietyNotice('DOUBLE POP!', '#ffdd82');
    else if (this.currentVariant === 'gold') this.varietyNotice('GOLD +50!', '#ffd774');
    else if (this.currentVariant === 'sunglasses')
      this.varietyNotice(`COOL ${characterName()}`, '#b6d5ff');
    enterFromTree(this, this.hero, { x, y }, RAMIN_MOBILE_SCALE, plan, () => {
      if (this.roundOver || serial !== this.spawnSerial) return;
      if (event === 'fake-out') {
        applyRaminMood(this.hero, 'surprised');
        this.time.delayedCall(plan.visibleMs, () => {
          if (this.roundOver || serial !== this.spawnSerial) return;
          // Do not telegraph the trick before players have seen it.
          this.varietyNotice('FAKE-OUT!', '#ffc3ab');
          this.hide(() => this.time.delayedCall(160, () => this.pop()));
        });
        return;
      }
      this.activeTarget = true;
      this.moments.onSpawn(this.currentVariant);
      if (Math.random() < 0.12) raminMoment(this, this.hero, true);
      this.tweens.add({
        targets: this.hero,
        y: y - 5,
        duration: 480,
        ease: 'Sine.inOut',
        yoyo: true,
        repeat: 1,
      });
      this.time.delayedCall(plan.visibleMs + 100, () => {
        if (this.roundOver || serial !== this.spawnSerial || !this.activeTarget) return;
        this.activeTarget = false;
        this.combo = 0;
        this.comboText.setText('× 0');
        this.hide(() =>
          this.time.delayedCall(this.pendingDouble ? 105 : plan.pauseMs, () => this.pop()),
        );
      });
    });
  }
  private varietyNotice(message: string, color: string) {
    const banner = text(this, 270, 292, message, 24, color)
      .setDepth(116)
      .setBackgroundColor('#18263d')
      .setPadding(10, 6);
    this.tweens.add({
      targets: banner,
      y: 278,
      alpha: 0,
      duration: 780,
      delay: 410,
      onComplete: () => banner.destroy(),
    });
  }
  private hide(next: () => void) {
    exitBehindTreeWithSlip(
      this,
      this.hero,
      this.currentPlan,
      () => {
        this.sticker.setVisible(false);
        this.accessory.setVisible(false);
        if (!this.roundOver) next();
      },
      this.moments.shouldSlip(),
    );
  }
  private shoot(pointer: Phaser.Input.Pointer) {
    const aim = { x: pointer.x, y: pointer.y };
    if (this.roundOver) return;
    // Never discard a legitimate golden pickup while an ordinary shot is flying.
    if (
      getSelectedGameMode() === 'classic' &&
      this.golden.tryCollect(aim.x, aim.y, this.roundElapsedMs)
    )
      return;
    if (this.shooting) return;
    if (!this.activeTarget || aim.y < HUD_BOTTOM || aim.y > SELECTOR_TOP) return;
    const shotIsGolden =
      getSelectedGameMode() === 'classic' &&
      shouldLaunchGolden(this.selectedStyle, this.goldenArmed, this.golden.ready) &&
      this.golden.consume();
    this.goldenArmed = false;
    this.shooting = true;
    this.activeTarget = false;
    this.spawnSerial++;
    this.tweens.killTweensOf(this.hero);
    const style = this.selectedStyle;
    const variant = this.currentVariant;
    playSfx('shot');
    launchMustache(
      this,
      mustacheTexture(style, shotIsGolden || getSelectedGameMode() === 'goldRush'),
      { x: 270, y: 772 },
      aim,
      { width: 100, height: 49 },
      () => {
        if (this.roundOver) return;
        this.shooting = false;
        const mouth = raminLipPoint(this.hero);
        const comboBefore = this.combo;
        const outcome = resolveRoundShot({
          aim,
          lip: mouth,
          score: this.score,
          combo: this.combo,
          stats: this.stats,
          variant,
          portrait: true,
          goldenShot: shotIsGolden,
          mode: getSelectedGameMode(),
          perfectStreakBefore: this.perfectStreak,
        });
        const { result, reward, gained, goldenPerfect, goldRushBonus } = outcome;
        this.perfectStreak = outcome.perfectStreak;
        this.golden.setPerfectStreak(this.perfectStreak);
        recordCompetitiveShot({
          tMs: Math.min(46000, Math.round(this.roundElapsedMs)),
          aim,
          lip: mouth,
          variant,
          comboBefore,
          goldenShot: shotIsGolden,
        });
        this.stats = outcome.stats;
        this.score = outcome.score;
        this.combo = outcome.combo;
        showLandingPrecision(this, aim, mouth, result.grade);
        haptic(result.grade);
        if (result.grade === 'miss') {
          this.combo = 0;
          this.comboText.setText('× 0');
          playSfx('miss');
          this.feedback(aim.x, aim.y, 'MISS!', '#ff8eaa');
          resolveMissImpact(
            this,
            mustacheTexture(style, shotIsGolden || getSelectedGameMode() === 'goldRush'),
            aim,
            { centers: MOBILE_TREE_CENTERS, centerY: 552, halfWidth: 23, top: 395, bottom: 738 },
            84,
            44,
          );
          burstLeaves(this, aim.x, aim.y, 3);
        } else {
          this.scoreText.setText(String(this.score).padStart(5, '0'));
          this.comboText.setText('× ' + this.combo);
          this.tweens.add({ targets: this.comboText, scale: 1.25, duration: 125, yoyo: true });
          celebrateCombo(this, true, this.combo);
          playSfx(result.grade === 'perfect' ? 'perfect' : 'good');
          applyRaminMood(this.hero, 'surprised');
          this.sticker
            .setTexture(
              mustacheTexture(style, shotIsGolden || getSelectedGameMode() === 'goldRush'),
            )
            .setPosition(aim.x, aim.y)
            .setRotation(this.hero.rotation)
            .setVisible(true);
          this.stickerAnchor = toHeroAnchor(this.hero, aim);
          attachMustache(this, this.sticker, style, result.grade);
          this.moments.onHit(result.grade, this.combo);
          burstStars(this, aim.x, aim.y, result.grade === 'perfect');
          impactRing(this, aim.x, aim.y, result.grade === 'perfect');
          hitReaction(this, this.hero, RAMIN_MOBILE_SCALE, result.grade === 'perfect');
          this.feedback(
            mouth.x,
            this.hero.y - 190,
            '+' + gained + ' ' + result.grade.toUpperCase() + '!',
            result.grade === 'perfect' ? '#ffe083' : '#aaf3d4',
          );
          if (goldenPerfect) this.varietyNotice('GOLDEN PERFECT +350!', '#ffe085');
          else if (goldRushBonus)
            this.varietyNotice('GOLD RUSH +' + goldRushBonus + '!', '#ffe085');
          else if (reward.bonus > 0) this.varietyNotice(reward.label, '#ffe291');
          if (result.grade === 'perfect' && this.combo >= 3 && Math.random() < 0.3) {
            applyRaminMood(this.hero, 'victory');
            raminMoment(this, this.hero, true);
          }
          rarePerfectSlowMo(this, result.grade === 'perfect', this.combo);
        }
        this.updateMissions(this.score, this.stats.perfect, this.combo);
        this.time.delayedCall(result.grade === 'miss' ? 180 : 440, () => {
          if (this.roundOver) return;
          this.hide(() =>
            this.time.delayedCall(this.pendingDouble ? 105 : this.currentPlan.pauseMs, () =>
              this.pop(),
            ),
          );
        });
      },
    );
  }
  update(_time: number, delta: number) {
    // Phaser's this.time.now is wall-clock based; paused tutorial screens can
    // make a 45-second round appear minutes long. Scene update only runs while
    // gameplay is active, so count its frame deltas instead.
    if (!this.scoreRoundStarted) {
      this.scoreRoundStarted = true;
      startCompetitiveRound(true, getSelectedGameMode());
    }
    this.roundElapsedMs = accumulateActiveRoundMs(this.roundElapsedMs, delta);
    if (getSelectedGameMode() === 'classic') this.golden.update(this.roundElapsedMs);
    if (this.hero?.active) this.followLighting(this.hero);
    if (this.hero?.active && this.accessory?.active) syncAccessory(this.hero, this.accessory);
    if (this.moments) this.moments.update();
    if (this.hero?.active && this.sticker?.visible && this.stickerAnchor) {
      const point = fromHeroAnchor(this.hero, this.stickerAnchor);
      const twist = this.sticker.getData('impactTwist') as { offset: number } | undefined;
      this.sticker
        .setPosition(point.x, point.y)
        .setRotation(this.hero.rotation + (twist?.offset ?? 0))
        .setAlpha(this.hero.alpha);
    }
  }
  private feedback(x: number, y: number, words: string, color: string) {
    const sx = Phaser.Math.Clamp(x, 110, 430);
    const sy = Phaser.Math.Clamp(y, 230, 685);
    const floating = text(this, sx, sy, words, words.length > 10 ? 25 : 32, color).setDepth(97);
    this.tweens.add({
      targets: floating,
      y: sy - 55,
      alpha: 0,
      duration: 850,
      ease: 'Cubic.easeOut',
      onComplete: () => floating.destroy(),
    });
  }
  private finish() {
    if (this.roundOver) return;
    this.roundOver = true;
    this.activeTarget = false;
    this.input.enabled = false;
    playSfx('finish');
    stopMusic();
    const best = Math.max(this.score, readBestScore(getSelectedGameMode()));
    saveBestScore(best, getSelectedGameMode());
    const summary = summarizeRound(this.stats, this.score);
    this.scene.start('Results', { score: this.score, best, summary });
  }
}

type ResultData = { score: number; best: number; summary: RoundSummary };
export class MobileResultsScene extends Phaser.Scene {
  private score = 0;
  private best = 0;
  private summary: RoundSummary = summarizeRound(emptyStats, 0);
  constructor() {
    super('Results');
  }
  init(data: ResultData) {
    this.score = data.score ?? 0;
    this.best = data.best ?? 0;
    this.summary = data.summary ?? summarizeRound(emptyStats, this.score);
  }
  create() {
    portraitBackdrop(this);
    addArcadeAccents(this, true);
    panel(this, 270, 481, 512, 902, 0x132137, 0.96, 50);
    text(
      this,
      270,
      108,
      getSelectedGameMode() === 'goldRush' ? 'GOLD RUSH COMPLETE!' : 'ROUND COMPLETE!',
      38,
      '#ffd281',
    );
    addSoundToggle(this, 460, 58, 112);
    addMusicToggle(this, 70, 58, 112);
    const hero = makeRamin(this, 270, 382, RAMIN_MOBILE_SCALE * 1.06, 'victory').setDepth(55);
    const lip = raminLipPoint(hero);
    const resultsStache = this.add
      .image(lip.x, lip.y, mustacheTexture(0))
      .setDisplaySize(88, 48)
      .setDepth(56);
    this.tweens.add({
      targets: hero,
      y: 375,
      angle: 2,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      const mouth = raminLipPoint(hero);
      resultsStache.setPosition(mouth.x, mouth.y).setRotation(hero.rotation);
    });
    this.add.image(433, 247, 'coin').setDisplaySize(74, 74).setDepth(57);
    text(this, 270, 549, 'YOUR SCORE', 24, '#d9c8e4');
    text(this, 270, 616, String(this.score).padStart(5, '0'), 67, '#fff0b1');
    text(
      this,
      270,
      176,
      'MEDAL: ' + this.summary.medal,
      24,
      this.summary.medal === 'GOLD'
        ? '#ffe085'
        : this.summary.medal === 'SILVER'
          ? '#daeaff'
          : '#dba881',
    );
    text(this, 270, 685, `PERSONAL BEST: ${this.best}`, 22, '#adf3c8');
    text(
      this,
      270,
      729,
      `ACCURACY: ${this.summary.accuracy}%  ·  PERFECT: ${this.summary.perfect}`,
      21,
      '#f2e5be',
    );
    text(
      this,
      270,
      751,
      `HITS: ${this.summary.hits}/${this.summary.shots}  ·  MAX COMBO: ${this.summary.maxCombo}`,
      19,
      '#cbebdd',
    );
    addResultsExtras(this, true, this.score, this.summary);
    const replay = this.add
      .rectangle(157, 842, 272, 66, 0x9b6bef)
      .setStrokeStyle(4, 0x463064)
      .setDepth(81)
      .setInteractive({ useHandCursor: true });
    text(this, 157, 842, '↻ PLAY AGAIN', 22, '#ffffff');
    replay.on('pointerdown', () => {
      playSfx('start');
      this.scene.start('Play');
    });
    const changeHero = this.add
      .rectangle(413, 842, 216, 66, 0x36495b)
      .setStrokeStyle(4, 0xb39fda)
      .setDepth(81)
      .setInteractive({ useHandCursor: true });
    text(this, 413, 842, 'CHANGE HERO', 19, '#ffffff');
    changeHero.on('pointerdown', () => this.scene.start('CharacterSelect'));
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('Play'));
  }
}
