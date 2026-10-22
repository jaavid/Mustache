import Phaser from 'phaser';
import { trackEvent } from '../platform/analytics';
import { hapticsEnabled, toggleHaptics } from './haptics';
import { setMusicPaused, stopMusic } from './sound';
import { getSelectedCharacter, mustacheTexture } from './characterChoice';

const FONT = '"Courier New", monospace';
const GUIDE_KEY = 'n5-tutorial-complete-v1';
type OverlayData = { portrait?: boolean; source?: 'manual' | 'visibility' };

function heading(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color = '#ffe09c',
) {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT,
      fontSize: size + 'px',
      fontStyle: 'bold',
      color,
      stroke: '#151329',
      strokeThickness: 4,
      align: 'center',
    })
    .setOrigin(0.5);
}
function overlayButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  caption: string,
  onClick: () => void,
) {
  const hit = scene.add
    .rectangle(x, y, w, 58, 0x9670e2)
    .setStrokeStyle(4, 0x4b3668)
    .setInteractive({ useHandCursor: true });
  const txt = heading(scene, x, y, caption, 21, '#ffffff');
  hit.on(
    'pointerdown',
    (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      onClick();
    },
  );
  return { hit, txt };
}
export function needsFirstRunGuide(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) !== 'true';
  } catch {
    return false;
  }
}
export function beginTutorial(scene: Phaser.Scene, portrait: boolean): void {
  if (!needsFirstRunGuide()) return;
  setMusicPaused(true);
  scene.scene.launch('Guide', { portrait });
  scene.scene.pause('Play');
}
export function pauseRound(
  scene: Phaser.Scene,
  portrait: boolean,
  source: 'manual' | 'visibility' = 'manual',
): void {
  if (!scene.scene.isActive('Play')) return;
  setMusicPaused(true);
  trackEvent('pause', { layout: portrait ? 'portrait' : 'landscape', source });
  scene.scene.launch('PauseOverlay', { portrait, source });
  scene.scene.pause('Play');
}
export function addPauseButton(scene: Phaser.Scene, x: number, y: number, portrait: boolean) {
  const hit = scene.add
    .rectangle(x, y, 104, 37, 0x142338, 0.96)
    .setStrokeStyle(3, 0xffd783)
    .setDepth(125)
    .setInteractive({ useHandCursor: true });
  scene.add
    .text(x, y, 'Ⅱ  PAUSE', {
      fontFamily: FONT,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffe5a9',
    })
    .setOrigin(0.5)
    .setDepth(126);
  hit.on(
    'pointerdown',
    (
      _pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      pauseRound(scene, portrait);
    },
  );
}
export function registerRoundVisibility(scene: Phaser.Scene, portrait: boolean): void {
  const hide = () => {
    if (document.hidden && scene.scene.isActive('Play')) pauseRound(scene, portrait, 'visibility');
  };
  document.addEventListener('visibilitychange', hide);
  scene.input.keyboard?.on('keydown-P', () => pauseRound(scene, portrait));
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    document.removeEventListener('visibilitychange', hide);
    stopMusic();
  });
}

/** Tutorial runs on its own time clock while the actual 45-second round is frozen. */
export class GuideScene extends Phaser.Scene {
  private portrait = false;
  constructor() {
    super('Guide');
  }
  init(data: OverlayData) {
    this.portrait = !!data.portrait;
  }
  create() {
    const w = this.scale.width,
      h = this.scale.height,
      x = w / 2,
      y = h / 2;
    this.add.rectangle(x, y, w, h, 0x081324, 0.94).setInteractive();
    this.add
      .rectangle(x, y, this.portrait ? 492 : 700, this.portrait ? 630 : 425, 0x17273f)
      .setStrokeStyle(5, 0x9470b5);
    const title = heading(
      this,
      x,
      y - (this.portrait ? 255 : 169),
      'HOW TO PLAY',
      this.portrait ? 32 : 36,
    );
    title.setColor('#ffd58f');
    const stepTitle = heading(this, x, y - (this.portrait ? 159 : 95), '', this.portrait ? 26 : 26);
    const description = heading(
      this,
      x,
      y + (this.portrait ? 70 : 40),
      '',
      this.portrait ? 22 : 20,
      '#e6f9df',
    );
    const visual = this.add
      .image(x, y - (this.portrait ? 45 : 26), mustacheTexture(1))
      .setDisplaySize(135, 60);
    const hint = heading(
      this,
      x,
      y + (this.portrait ? 148 : 95),
      '',
      this.portrait ? 17 : 16,
      '#c0bad8',
    );
    const progress = heading(this, x, y + (this.portrait ? 225 : 136), '', 17, '#c5a3ff');
    const layout = this.portrait ? 'portrait' : 'landscape';
    trackEvent('tutorial_start', { layout });
    let index = 0;
    let finished = false;
    const renderedSteps = new Set<number>();
    const steps = [
      ['CHOOSE A MUSTACHE', 'Tap one of the 3 styles below.', '1  ·  2  ·  3'],
      [
        'AIM BELOW THE NOSE',
        'Tap the hero’s upper lip, not the eyes.',
        'The mustache flies to your target',
      ],
      [
        'SCORE A PERFECT',
        'Land in the center for maximum points!',
        'Look out for rare costumes & bonuses',
      ],
    ] as const;
    const render = () => {
      stepTitle.setText(steps[index][0]);
      description.setText(steps[index][1]);
      hint.setText(steps[index][2]);
      progress.setText('STEP ' + (index + 1) + ' / 3');
      visual.setTexture(
        index === 1
          ? getSelectedCharacter() === 'borhan'
            ? 'borhan-sheet'
            : 'ramin-sheet'
          : mustacheTexture(index === 0 ? 1 : 2),
      );
      if (index === 1) visual.setFrame(0).setDisplaySize(105, 178);
      else visual.setDisplaySize(135, 60);
      if (!renderedSteps.has(index)) {
        renderedSteps.add(index);
        trackEvent('tutorial_step', { layout, step: index + 1 });
      }
    };
    const finish = (outcome: 'completed' | 'skipped') => {
      if (finished) return;
      finished = true;
      trackEvent('tutorial_end', { layout, outcome });
      try {
        localStorage.setItem(GUIDE_KEY, 'true');
      } catch {
        /* optional */
      }
      this.scene.resume('Play');
      this.scene.stop();
      setMusicPaused(false);
    };
    const advance = () => {
      if (finished) return;
      index++;
      if (index >= 3) finish('completed');
      else render();
    };
    overlayButton(
      this,
      x + (this.portrait ? 65 : 180),
      y + (this.portrait ? 289 : 181),
      this.portrait ? 230 : 230,
      'NEXT  ▶',
      advance,
    );
    overlayButton(
      this,
      x - (this.portrait ? 145 : 180),
      y + (this.portrait ? 289 : 181),
      this.portrait ? 140 : 150,
      'SKIP',
      () => finish('skipped'),
    );
    this.time.addEvent({ delay: 3400, loop: true, callback: () => advance() });
    render();
  }
}

/** Pause overlay remains interactive while Play's tweens/timers are fully stopped. */
export class PauseOverlayScene extends Phaser.Scene {
  private portrait = false;
  private source: 'manual' | 'visibility' = 'manual';
  constructor() {
    super('PauseOverlay');
  }
  init(data: OverlayData) {
    this.portrait = !!data.portrait;
    this.source = data.source ?? 'manual';
  }
  create() {
    const x = this.scale.width / 2,
      y = this.scale.height / 2;
    this.add.rectangle(x, y, this.scale.width, this.scale.height, 0x091323, 0.88).setInteractive();
    this.add
      .rectangle(x, y, this.portrait ? 482 : 560, this.portrait ? 430 : 355, 0x16253e)
      .setStrokeStyle(5, 0x9973d2);
    heading(this, x, y - (this.portrait ? 151 : 121), 'GAME PAUSED', this.portrait ? 35 : 38);
    heading(
      this,
      x,
      y - (this.portrait ? 91 : 62),
      'Take your time!',
      this.portrait ? 20 : 19,
      '#bbe8d6',
    );
    const countdown = heading(this, x, y + 22, '', 69, '#ffeab7');
    let starting = false;
    const resume = () => {
      if (starting) return;
      starting = true;
      button.hit.disableInteractive();
      button.txt.setText('GET READY...');
      let remaining = 3;
      countdown.setText(String(remaining));
      this.time.addEvent({
        delay: 1000,
        repeat: 2,
        callback: () => {
          remaining--;
          if (remaining === 0) {
            trackEvent('resume', {
              layout: this.portrait ? 'portrait' : 'landscape',
              source: this.source,
            });
            this.scene.resume('Play');
            this.scene.stop();
            setMusicPaused(false);
          } else countdown.setText(String(remaining));
        },
      });
    };
    const button = overlayButton(this, x, y + (this.portrait ? 92 : 92), 246, '▶  RESUME', resume);
    if (this.portrait) {
      const toggle = overlayButton(
        this,
        x,
        y + 170,
        260,
        'HAPTICS ' + (hapticsEnabled() ? 'ON' : 'OFF'),
        () => {
          toggle.txt.setText('HAPTICS ' + (toggleHaptics() ? 'ON' : 'OFF'));
        },
      );
    }
    this.input.keyboard?.once('keydown-P', resume);
    this.input.keyboard?.once('keydown-ESC', resume);
  }
}
