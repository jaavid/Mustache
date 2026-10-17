import Phaser from 'phaser';
import { createArt } from './art';
import { preloadForestTreeSources, createForestTreeTextures } from './forestTreeAssets';
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
  rarePerfectAccent,
} from './arcadeVisuals';
import { tunePopPlan } from '../logic/arcadePhases';
import { setMusicPhase } from './sound';
import { addResultsExtras } from './replayUi';
import { addForestLife, burstLeaves, burstStars } from './ambience';
import {
  applyRaminMood,
  ensureRaminAnimations,
  makeRamin,
  preloadRamin,
  RAMIN_DESKTOP_SCALE,
  raminLipPoint,
} from './ramin';
import { readBestScore, ROUND_LENGTH_SECONDS, saveBestScore } from '../logic/scoring';
import { resolveRoundShot } from '../logic/shotResolution';
import { startCompetitiveRound, recordCompetitiveShot } from '../platform/competitiveScores';
import { accumulateActiveRoundMs } from '../logic/activeRoundClock';
import { nextSlot, popPlan, type PopPlan } from '../logic/gameplay';
import {
  DESKTOP_TREE_CENTERS,
  DESKTOP_TRUNK_BOUNDS,
  DESKTOP_PEEK_DISTANCE,
  chooseSpawnSide,
  peekPosition,
} from '../logic/treeGeometry';
import { enterFromTree, exitBehindTreeWithSlip, hitReaction, launchMustache } from './gameFeel';
import { addGameplayTrees } from './forestTrees';
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

const WIDTH = 960;
const HEIGHT = 540;
const FONT = '"Courier New", monospace';

function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
  size: number,
  color = '#ffffff',
) {
  return scene.add
    .text(x, y, message, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      stroke: '#211d34',
      strokeThickness: 4,
      align: 'center',
    })
    .setOrigin(0.5)
    .setDepth(85);
}
function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  message: string,
  onPress: () => void,
) {
  const shadow = scene.add.rectangle(x + 4, y + 6, w, h, 0x141c2d).setDepth(75);
  const fill = scene.add
    .rectangle(x, y, w, h, 0xa779f2)
    .setStrokeStyle(5, 0x3b2a61)
    .setDepth(76)
    .setInteractive({ useHandCursor: true });
  const shine = scene.add.rectangle(x, y - h / 2 + 6, w - 12, 5, 0xdab5ff, 0.65).setDepth(77);
  const text = label(scene, x, y, message, Math.min(26, h * 0.42), '#ffffff');
  fill.on('pointerover', () => {
    fill.setFillStyle(0xc28bff);
    text.setScale(1.05);
  });
  fill.on('pointerout', () => {
    fill.setFillStyle(0xa779f2);
    text.setScale(1);
  });
  fill.on('pointerdown', () => onPress());
  return { fill, shadow, shine, text };
}
function backdrop(scene: Phaser.Scene, withFireflies = true) {
  scene.add.image(480, 270, 'forest').setDisplaySize(WIDTH, HEIGHT).setDepth(-40);
  addForestLife(scene);
  if (withFireflies) {
    for (let i = 0; i < 26; i++) {
      const x = (i * 173 + 101) % WIDTH;
      const y = (i * 97 + 53) % 420;
      const dot = scene.add
        .rectangle(
          x,
          y,
          i % 3 === 0 ? 5 : 3,
          i % 3 === 0 ? 5 : 3,
          i % 2 ? 0xffd88a : 0x8df8c7,
          0.55,
        )
        .setDepth(12);
      scene.tweens.add({
        targets: dot,
        y: y - 14,
        alpha: 0.1,
        duration: 1100 + i * 94,
        yoyo: true,
        repeat: -1,
        delay: i * 55,
      });
    }
  }
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  preload() {
    const w = this.scale.width,
      h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, 0x10182a);
    this.add
      .text(w / 2, h / 2 - 67, 'N5 · MUSTACHE MAYHEM', {
        fontFamily: '"Courier New", monospace',
        fontSize: '25px',
        fontStyle: 'bold',
        color: '#ffd681',
      })
      .setOrigin(0.5);
    const progressText = this.add
      .text(w / 2, h / 2 + 55, 'LOADING 0%', {
        fontFamily: '"Courier New", monospace',
        fontSize: '18px',
        color: '#dec2ff',
      })
      .setOrigin(0.5);
    const bar = this.add.graphics();
    const redraw = (value: number) => {
      bar.clear();
      bar.fillStyle(0x332d46).fillRect(w / 2 - 166, h / 2 - 9, 332, 30);
      bar.fillStyle(0xb58af1).fillRect(w / 2 - 162, h / 2 - 5, 324 * value, 22);
      progressText.setText('LOADING ' + Math.round(value * 100) + '%');
    };
    redraw(0);
    this.load.on('progress', redraw);
    preloadRamin(this);
    preloadForestTreeSources(this);
  }
  create() {
    createArt(this);
    createForestTreeTextures(this);
    ensureRaminAnimations(this);
    this.scene.start('Menu');
  }
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }
  create() {
    backdrop(this);
    addArcadeAccents(this, false);
    // Woodland signboard and stacked arcade title.
    this.add.rectangle(325, 202, 568, 304, 0x101b29, 0.74).setStrokeStyle(5, 0x735745).setDepth(40);
    this.add.rectangle(325, 73, 552, 11, 0x92704b).setDepth(41);
    this.add.rectangle(325, 332, 552, 11, 0x92704b).setDepth(41);
    label(this, 104, 56, '◈ N5 ARCADE', 22, '#f7c86d').setOrigin(0, 0.5);
    label(this, 310, 140, 'MUSTACHE', 55, '#ffd173').setShadow(4, 5, '#3c1a35', 0, true, true);
    label(this, 310, 207, 'MAYHEM', 65, '#c49bff').setShadow(4, 5, '#38193e', 0, true, true);
    label(this, 310, 267, 'AIM  ·  SHOOT  ·  STACHE', 18, '#e4dbb7');
    const start = () => {
      setSelectedGameMode('classic');
      playSfx('start');
      this.scene.start('CharacterSelect');
    };
    addSoundToggle(this, 895, 42);
    addMusicToggle(this, 895, 94, 106);
    button(this, 305, 385, 285, 68, '▶  FOREST', start);
    addProgressionMenu(this, false, () => {
      setSelectedGameMode('goldRush');
      playSfx('start');
      this.scene.start('CharacterSelect');
    });
    // The Gold Rush action occupies this area.
    const hero = makeRamin(this, 775, 326, RAMIN_DESKTOP_SCALE, 'blink').setDepth(41);
    hero.setAngle(-5);
    this.tweens.add({
      targets: hero,
      y: 312,
      duration: 1400,
      ease: 'Sine.inOut',
      yoyo: true,
      repeat: -1,
    });
    const menuStache = this.add
      .image(775, 278, mustacheTexture(0))
      .setDisplaySize(68, 38)
      .setDepth(46)
      .setAngle(-5);
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      const lip = raminLipPoint(hero);
      menuStache.setPosition(lip.x, lip.y).setRotation(hero.rotation);
    });
    this.add.image(745, 106, 'coin').setScale(1.6).setDepth(46);
    label(this, 790, 481, `MEET ${characterName()}!`, 23, '#ffe19a');
    label(this, 310, 514, '45 SECONDS · PERFECT AIM', 13, '#c0efd8');
    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.keyboard?.once('keydown-SPACE', start);
  }
}

export class PlayScene extends Phaser.Scene {
  private score = 0;
  private perfectStreak = 0;
  private roundElapsedMs = 0;
  private scoreRoundStarted = false;
  private combo = 0;
  private remaining = ROUND_LENGTH_SECONDS;
  private selectedStyle = 0;
  private hero!: Phaser.GameObjects.Sprite;
  private sticker!: Phaser.GameObjects.Image;
  private stickerAnchor: StickerAnchor | null = null;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private styleMarkers: Phaser.GameObjects.Rectangle[] = [];
  private styleIcons: Phaser.GameObjects.Image[] = [];
  private styleLabels: Phaser.GameObjects.Text[] = [];
  private goldenArmed = false;
  private active = false;
  private roundOver = false;
  private shooting = false;
  private spawnSerial = 0;
  private previousSlot = -1;
  private cursor!: Phaser.GameObjects.Graphics;
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
    this.active = false;
    this.roundOver = false;
    this.shooting = false;
    this.spawnSerial = 0;
    this.previousSlot = -1;
    this.pendingDouble = false;
    this.previousEvent = 'normal';
    this.currentVariant = 'normal';
    this.stats = { ...emptyStats };
    this.stickerAnchor = null;
    backdrop(this);
    if (getSelectedGameMode() === 'goldRush') addGoldVault(this, false);
    addGameplayTrees(this, false);
    addArcadeAccents(this, false);
    const lighting = addLivingForest(this, false);
    this.followLighting = lighting.follow;
    const phaseHud = addPhaseHud(this, false, (phase) => {
      lighting.setPhase(phase);
      setMusicPhase(phase);
      announcePhase(this, false, phase);
    });
    this.updatePhase = phaseHud.update;
    this.updateMissions = addMissionStrip(this, false).update;
    this.hero = makeRamin(this, -200, 324, RAMIN_DESKTOP_SCALE, 'idle').setVisible(false);
    this.accessory = makeAccessory(this);
    this.moments = new RaminMomentController(this, this.hero, this.accessory, false);
    this.sticker = this.add
      .image(-200, 320, mustacheTexture(0, getSelectedGameMode() === 'goldRush'))
      .setDisplaySize(66, 37)
      .setDepth(31)
      .setVisible(false);
    this.createHud();
    this.golden = new GoldenFlyer(
      this,
      false,
      (message, color) => this.varietyNotice(message, color),
      (ready) => this.updateGoldenSelector(ready),
      getSelectedGameMode() === 'goldRush',
    );
    addSoundToggle(this, 895, 36);
    addMusicToggle(this, 896, 105, 106);
    addPauseButton(this, 780, 105, false);
    this.createSelector();
    this.cursor = this.add.graphics().setDepth(95);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) =>
      this.drawCursor(pointer.x, pointer.y),
    );
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointer(pointer));
    this.input.keyboard?.on('keydown-ONE', () => this.selectStyle(0));
    this.input.keyboard?.on('keydown-TWO', () => this.selectStyle(1));
    this.input.keyboard?.on('keydown-THREE', () => this.selectStyle(2));
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.roundOver) this.finishRound();
    });
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.roundOver) return;
        this.remaining--;
        this.updatePhase(ROUND_LENGTH_SECONDS - this.remaining);
        this.timerText.setText(`00:${String(Math.max(this.remaining, 0)).padStart(2, '0')}`);
        if (this.remaining <= 10) this.timerText.setColor('#ff929c');
        if (this.remaining <= 0) this.finishRound();
      },
    });
    const hint = label(
      this,
      480,
      216,
      'WATCH THE TREES · AIM FOR THE LIP!',
      17,
      '#ffedbc',
    ).setDepth(65);
    this.tweens.add({
      targets: hint,
      alpha: 0,
      y: 203,
      duration: 850,
      delay: 1500,
      onComplete: () => hint.destroy(),
    });
    this.time.delayedCall(650, () => this.popTarget());
    startMusic();
    registerRoundVisibility(this, false);
    beginTutorial(this, false);
  }
  private createHud() {
    const top = this.add
      .rectangle(480, 36, 938, 66, 0x131d2b, 0.92)
      .setStrokeStyle(4, 0x6e547e)
      .setDepth(72);
    top.setAlpha(0.96);
    this.add.image(54, 36, 'coin').setDisplaySize(51, 51).setDepth(80);
    label(this, 155, 23, 'SCORE', 15, '#dcc59f');
    this.scoreText = label(this, 160, 48, '00000', 23, '#fff6ce');
    label(this, 475, 22, 'TIME LEFT', 15, '#d9cbb4');
    this.timerText = label(this, 477, 49, '00:45', 26, '#ffffff');
    label(this, 772, 22, 'COMBO', 15, '#d9cbb4');
    this.comboText = label(this, 773, 49, '× 0', 25, '#bca1ff');
    const under = this.add.rectangle(480, 102, 700, 31, 0x131c2d, 0.65).setDepth(68);
    under.setStrokeStyle(2, 0x525970, 0.8);
    label(this, 480, 102, 'TARGET: THE SPACE BELOW HIS NOSE!', 16, '#e6e8c3');
  }
  private createSelector() {
    const board = this.add
      .rectangle(480, 498, 952, 78, 0x121d29, 0.96)
      .setStrokeStyle(4, 0x765a79)
      .setDepth(70);
    board.setAlpha(0.97);
    label(this, 116, 476, 'CHOOSE YOUR', 14, '#d5c9a7');
    label(this, 116, 499, 'MUSTACHE', 19, '#ffce7c');
    label(this, 118, 523, '1 · 2 · 3', 12, '#a9c5b6');
    this.styleMarkers = [];
    this.styleIcons = [];
    this.styleLabels = [];
    for (let i = 0; i < 3; i++) {
      const x = 355 + i * 124;
      const mark = this.add
        .rectangle(x, 498, 102, 62, 0x2c2d49)
        .setStrokeStyle(4, 0x68627c)
        .setDepth(73)
        .setInteractive({ useHandCursor: true });
      mark.on(
        'pointerdown',
        (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.selectStyle(i);
          playSfx('select');
          haptic('select');
        },
      );
      this.styleIcons.push(
        this.add
          .image(x, 498, mustacheTexture(i, getSelectedGameMode() === 'goldRush'))
          .setDisplaySize(86, 40)
          .setDepth(74),
      );
      this.styleLabels.push(label(this, x - 43, 472, String(i + 1), 12, '#fbd88e'));
      this.styleMarkers.push(mark);
    }
    this.selectStyle(0);
    label(this, 813, 482, 'CLICK / TAP', 17, '#f6da90');
    label(this, 815, 508, 'TO LAUNCH!', 16, '#e3caff');
  }
  private selectStyle(style: number) {
    this.selectedStyle = style;
    // Reselect slot 2 after charging to arm the special shot; never auto-arm.
    this.goldenArmed =
      getSelectedGameMode() === 'classic' && armGoldenForSelection(style, this.golden.ready);
    this.refreshSelector();
  }
  private updateGoldenSelector(ready: boolean) {
    this.goldenArmed = false;
    const icon = this.styleIcons[1];
    this.tweens.killTweensOf(icon);
    icon.setAlpha(1).setTexture(mustacheTexture(1, ready || getSelectedGameMode() === 'goldRush'));
    this.styleLabels[1].setText(ready ? 'GOLD' : '2').setColor(ready ? '#ffe291' : '#fbd88e');
    if (ready) {
      this.tweens.add({ targets: icon, alpha: 0.66, duration: 480, yoyo: true, repeat: -1 });
    }
    this.refreshSelector();
  }
  private refreshSelector() {
    this.styleMarkers.forEach((mark, index) => {
      const chosen = index === this.selectedStyle;
      const goldSlot = index === 1 && this.golden.ready;
      mark
        .setStrokeStyle(
          4,
          goldSlot ? (this.goldenArmed ? 0xfff3b7 : 0xe7b747) : chosen ? 0xffcd62 : 0x68627c,
        )
        .setFillStyle(
          goldSlot ? (this.goldenArmed ? 0x705331 : 0x3d3041) : chosen ? 0x55436d : 0x2c2d49,
        );
    });
  }
  private drawCursor(x: number, y: number) {
    this.cursor.clear();
    if (y >= 451 || this.roundOver) return;
    const color = 0xffe5aa;
    this.cursor.lineStyle(2, color, 0.85);
    this.cursor.strokeCircle(x, y, 13);
    this.cursor.lineBetween(x - 22, y, x - 8, y);
    this.cursor.lineBetween(x + 8, y, x + 22, y);
    this.cursor.lineBetween(x, y - 22, x, y - 8);
    this.cursor.lineBetween(x, y + 8, x, y + 22);
  }
  private popTarget() {
    if (this.roundOver) return;
    const slot = nextSlot(this.previousSlot, DESKTOP_TREE_CENTERS.length, Math.random());
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
    plan.side = chooseSpawnSide(slot, DESKTOP_TREE_CENTERS.length, plan.side);
    plan.shift = DESKTOP_PEEK_DISTANCE;
    if (event === 'fake-out') plan.visibleMs = 320;
    this.currentPlan = plan;
    this.active = false;
    this.shooting = false;
    const treeX = DESKTOP_TREE_CENTERS[slot];
    const x = peekPosition(treeX, plan.side, DESKTOP_PEEK_DISTANCE);
    const y = 315;
    this.moments.clear();
    this.stickerAnchor = null;
    applyRaminMood(this.hero, 'idle');
    this.sticker.setVisible(false);
    selectAccessory(this.accessory, this.currentVariant);
    burstLeaves(this, treeX, y + 95, 7);
    if (fromDouble) this.varietyNotice('AGAIN!', '#ffdd82');
    else if (event === 'double') this.varietyNotice('DOUBLE POP!', '#ffdd82');
    else if (this.currentVariant === 'gold')
      this.varietyNotice(`GOLD ${characterName()} · +50`, '#ffd774');
    else if (this.currentVariant === 'sunglasses')
      this.varietyNotice(`COOL ${characterName()}`, '#b6d5ff');
    enterFromTree(this, this.hero, { x, y }, RAMIN_DESKTOP_SCALE, plan, () => {
      if (this.roundOver || serial !== this.spawnSerial) return;
      if (event === 'fake-out') {
        applyRaminMood(this.hero, 'surprised');
        this.time.delayedCall(plan.visibleMs, () => {
          if (this.roundOver || serial !== this.spawnSerial) return;
          // Reveal the trick only when it has actually escaped.
          this.varietyNotice('FAKE-OUT!', '#ffc3ab');
          this.hideTarget(() => this.time.delayedCall(160, () => this.popTarget()));
        });
        return;
      }
      this.active = true;
      this.moments.onSpawn(this.currentVariant);
      if (Math.random() < 0.12) raminMoment(this, this.hero, false);
      this.tweens.add({
        targets: this.hero,
        y: y - 5,
        duration: 470,
        ease: 'Sine.inOut',
        yoyo: true,
        repeat: 1,
      });
      this.time.delayedCall(plan.visibleMs, () => {
        if (this.roundOver || serial !== this.spawnSerial || !this.active) return;
        this.active = false;
        this.combo = 0;
        this.comboText.setText('× 0');
        this.hideTarget(() =>
          this.time.delayedCall(this.pendingDouble ? 105 : plan.pauseMs, () => this.popTarget()),
        );
      });
    });
  }
  private varietyNotice(message: string, color: string) {
    const banner = label(this, 480, 377, message, 21, color)
      .setDepth(116)
      .setBackgroundColor('#18263d')
      .setPadding(9, 3);
    this.tweens.add({
      targets: banner,
      y: 361,
      alpha: 0,
      duration: 860,
      delay: 380,
      onComplete: () => banner.destroy(),
    });
  }
  private hideTarget(onEnd: () => void) {
    exitBehindTreeWithSlip(
      this,
      this.hero,
      this.currentPlan,
      () => {
        this.sticker.setVisible(false);
        this.accessory.setVisible(false);
        if (!this.roundOver) onEnd();
      },
      this.moments.shouldSlip(),
    );
  }
  private handlePointer(pointer: Phaser.Input.Pointer) {
    if (this.roundOver) return;
    // Collectibles remain tappable during the flight of an ordinary projectile.
    // One active shot per appearance is still enforced below.
    if (
      getSelectedGameMode() === 'classic' &&
      this.golden.tryCollect(pointer.x, pointer.y, this.roundElapsedMs)
    )
      return;
    if (this.shooting) return;
    if (!this.active || pointer.y < 125 || pointer.y > 450) return;
    const aim = { x: pointer.x, y: pointer.y };
    const shotIsGolden =
      getSelectedGameMode() === 'classic' &&
      shouldLaunchGolden(this.selectedStyle, this.goldenArmed, this.golden.ready) &&
      this.golden.consume();
    this.goldenArmed = false;
    this.shooting = true;
    this.active = false;
    this.spawnSerial++;
    this.tweens.killTweensOf(this.hero);
    const chosenStyle = this.selectedStyle;
    const variant = this.currentVariant;
    playSfx('shot');
    launchMustache(
      this,
      mustacheTexture(chosenStyle, shotIsGolden || getSelectedGameMode() === 'goldRush'),
      { x: 480, y: 459 },
      aim,
      { width: 75, height: 38 },
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
          portrait: false,
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
          this.popFeedback(aim.x, aim.y, 'MISS!', '#ff848f');
          resolveMissImpact(
            this,
            mustacheTexture(chosenStyle, shotIsGolden || getSelectedGameMode() === 'goldRush'),
            aim,
            DESKTOP_TRUNK_BOUNDS,
            66,
            34,
          );
        } else {
          this.scoreText.setText(String(this.score).padStart(5, '0'));
          this.comboText.setText('× ' + this.combo);
          this.tweens.add({ targets: this.comboText, scale: 1.22, duration: 115, yoyo: true });
          celebrateCombo(this, false, this.combo);
          playSfx(result.grade === 'perfect' ? 'perfect' : 'good');
          applyRaminMood(this.hero, 'surprised');
          this.sticker
            .setTexture(
              mustacheTexture(chosenStyle, shotIsGolden || getSelectedGameMode() === 'goldRush'),
            )
            .setPosition(aim.x, aim.y)
            .setRotation(this.hero.rotation)
            .setVisible(true);
          this.stickerAnchor = toHeroAnchor(this.hero, aim);
          attachMustache(this, this.sticker, chosenStyle, result.grade);
          this.moments.onHit(result.grade, this.combo);
          burstStars(this, aim.x, aim.y, result.grade === 'perfect');
          impactRing(this, aim.x, aim.y, result.grade === 'perfect');
          hitReaction(this, this.hero, RAMIN_DESKTOP_SCALE, result.grade === 'perfect');
          this.popFeedback(
            mouth.x,
            this.hero.y - 165,
            '+' + gained + ' ' + result.grade.toUpperCase() + '!',
            result.grade === 'perfect' ? '#ffd16c' : '#a7efc0',
          );
          if (goldenPerfect) this.varietyNotice('GOLDEN PERFECT +350!', '#ffe085');
          else if (goldRushBonus)
            this.varietyNotice('GOLD RUSH +' + goldRushBonus + '!', '#ffe085');
          else if (reward.bonus > 0) this.varietyNotice(reward.label, '#ffe291');
          if (result.grade === 'perfect' && this.combo >= 3 && Math.random() < 0.3) {
            applyRaminMood(this.hero, 'victory');
            raminMoment(this, this.hero, false);
          }
          rarePerfectAccent(this, this.hero, result.grade === 'perfect', this.combo);
        }
        this.updateMissions(this.score, this.stats.perfect, this.combo);
        this.time.delayedCall(result.grade === 'miss' ? 180 : 410, () => {
          if (this.roundOver) return;
          this.hideTarget(() =>
            this.time.delayedCall(this.pendingDouble ? 105 : this.currentPlan.pauseMs, () =>
              this.popTarget(),
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
      startCompetitiveRound(false, getSelectedGameMode());
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
  private popFeedback(x: number, y: number, message: string, color: string) {
    const cappedX = Phaser.Math.Clamp(x, 170, 790);
    const cappedY = Phaser.Math.Clamp(y, 162, 411);
    const text = label(
      this,
      cappedX,
      cappedY,
      message,
      message.length > 11 ? 26 : 32,
      color,
    ).setDepth(96);
    this.tweens.add({
      targets: text,
      y: cappedY - 44,
      alpha: 0,
      scale: 1.08,
      duration: 740,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }
  private finishRound() {
    if (this.roundOver) return;
    this.roundOver = true;
    this.active = false;
    this.input.enabled = false;
    playSfx('finish');
    stopMusic();
    const best = Math.max(this.score, readBestScore(getSelectedGameMode()));
    saveBestScore(best, getSelectedGameMode());
    const summary = summarizeRound(this.stats, this.score);
    this.scene.start('Results', { score: this.score, best, summary });
  }
}

type ResultsData = { score: number; best: number; summary: RoundSummary };
export class ResultsScene extends Phaser.Scene {
  private finalScore = 0;
  private bestScore = 0;
  private summary: RoundSummary = summarizeRound(emptyStats, 0);
  constructor() {
    super('Results');
  }
  init(data: ResultsData) {
    this.finalScore = data.score ?? 0;
    this.bestScore = data.best ?? 0;
    this.summary = data.summary ?? summarizeRound(emptyStats, this.finalScore);
  }
  create() {
    backdrop(this);
    addArcadeAccents(this, false);
    this.add.rectangle(500, 271, 885, 445, 0x142036, 0.94).setStrokeStyle(7, 0x806048).setDepth(40);
    this.add.rectangle(501, 59, 860, 10, 0xc49c65).setDepth(41);
    label(
      this,
      466,
      118,
      getSelectedGameMode() === 'goldRush' ? 'GOLD RUSH COMPLETE!' : 'ROUND COMPLETE!',
      43,
      '#ffcb6e',
    );
    addSoundToggle(this, 861, 79);
    addMusicToggle(this, 861, 133, 110);
    const resultsHero = makeRamin(this, 220, 318, RAMIN_DESKTOP_SCALE, 'victory').setDepth(53);
    const resultsLip = raminLipPoint(resultsHero);
    const resultStache = this.add
      .image(resultsLip.x, resultsLip.y, mustacheTexture(0))
      .setDisplaySize(70, 40)
      .setDepth(54);
    this.tweens.add({
      targets: resultsHero,
      y: 312,
      angle: 2,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      const mouth = raminLipPoint(resultsHero);
      resultStache.setPosition(mouth.x, mouth.y).setRotation(resultsHero.rotation);
    });
    this.add.image(317, 221, 'coin').setScale(1.2).setDepth(55);
    label(this, 640, 204, 'YOUR SCORE', 22, '#d7bee8');
    label(this, 640, 259, String(this.finalScore).padStart(5, '0'), 62, '#fff2bf');
    label(
      this,
      640,
      163,
      'MEDAL: ' + this.summary.medal,
      25,
      this.summary.medal === 'GOLD'
        ? '#ffe085'
        : this.summary.medal === 'SILVER'
          ? '#dbeaff'
          : '#d7a788',
    );
    label(this, 640, 312, `PERSONAL BEST: ${this.bestScore}`, 21, '#b5f6c6');
    label(
      this,
      645,
      340,
      `ACCURACY: ${this.summary.accuracy}%   PERFECT: ${this.summary.perfect}`,
      18,
      '#f1e8c6',
    );
    label(
      this,
      645,
      366,
      `HITS: ${this.summary.hits}/${this.summary.shots}   BEST COMBO: ${this.summary.maxCombo}`,
      17,
      '#cce9e3',
    );
    addResultsExtras(this, false, this.finalScore, this.summary);
    const again = () => {
      playSfx('start');
      this.scene.start('Play');
    };
    button(this, 642, 443, 324, 58, '↻  PLAY AGAIN', again);
    button(this, 642, 506, 262, 35, 'CHANGE HERO', () => this.scene.start('CharacterSelect'));
    this.input.keyboard?.once('keydown-ENTER', again);
    this.input.keyboard?.once('keydown-SPACE', again);
  }
}
