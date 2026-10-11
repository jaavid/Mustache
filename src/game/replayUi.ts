import Phaser from 'phaser';
import type { RoundSummary } from '../logic/roundStats';
import {
  achievementsForRound,
  missionsForRound,
  readAchievements,
  scoreShareText,
  storeNewAchievements,
} from '../logic/progression';
import { isTelegramGame, shareTelegramGame } from '../platform/telegramGame';
import { submitCompetitiveRound, getWeeklyLeaderboard, type Board } from '../platform/competitiveScores';

const FONT = '"Courier New", monospace';
export function addResultsExtras(
  scene: Phaser.Scene,
  portrait: boolean,
  score: number,
  summary: RoundSummary,
): void {
  const missions = missionsForRound(summary, score);
  const completed = missions.filter((m) => m.done).length;
  const newBadges = storeNewAchievements(achievementsForRound(summary, score));
  const total = readAchievements().length;
  const x = portrait ? 270 : 640;
  const y = portrait ? 781 : 392;
  const missionLine = 'MISSIONS: ' + completed + '/3  ·  BADGES: ' + total + '/5';
  const missionText = scene.add
    .text(x, y, missionLine + '\nSAVING ROUND...', {
      fontFamily: FONT,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#e6cbfc',
      stroke: '#1e2135',
      strokeThickness: 3,
      align: 'center',
    })
    .setOrigin(0.5)
    .setDepth(91);
  const achievement = newBadges[0];
  if (achievement) {
    const ax = portrait ? 270 : 245,
      ay = portrait ? 207 : 164;
    const txt = scene.add
      .text(ax, ay, 'NEW BADGE: ' + achievement.title, {
        fontFamily: FONT,
        fontSize: portrait ? '17px' : '16px',
        fontStyle: 'bold',
        color: '#ffe28f',
        backgroundColor: '#243249',
        padding: { x: 9, y: 5 },
        stroke: '#241f35',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(91);
    scene.tweens.add({ targets: txt, scale: 1.04, duration: 650, yoyo: true, repeat: 1 });
  }
  // Native Telegram ranks are all-time per Game Card. D1 resets every Monday UTC.
  let board: Board | undefined;
  const openBoard = () => {
    if (!board || !missionText.active) return;
    const w = portrait ? 540 : 960;
    const h = portrait ? 960 : 540;
    const layer = scene.add.container(0, 0).setDepth(250);
    const shade = scene.add.rectangle(w / 2, h / 2, w, h, 0x081525, 0.96).setInteractive();
    const panel = scene.add.rectangle(w / 2, h / 2, w - 45, portrait ? 700 : 445, 0x202a45)
      .setStrokeStyle(4, 0xc8a26e);
    const title = scene.add.text(w / 2, portrait ? 260 : 83, 'WEEKLY TOP 10 · UTC', {
      fontFamily: FONT, fontSize: portrait ? '25px' : '24px', color: '#ffdd92',
    }).setOrigin(0.5);
    const scores = board.players.length
      ? board.players.map((r) => '#' + String(r.rank).padStart(2, '0') + '  ' +
          r.name.slice(0, 16).padEnd(16) + ' ' + r.score).join('\n')
      : 'NO SCORES THIS WEEK';
    const names = scene.add.text(w / 2, portrait ? 325 : 135, scores, {
      fontFamily: FONT, fontSize: portrait ? '20px' : '20px',
      color: '#ebf7e9', lineSpacing: portrait ? 22 : 10, align: 'left',
    }).setOrigin(0.5, 0);
    const close = scene.add.text(w / 2, portrait ? 745 : 465, '✕  CLOSE', {
      fontFamily: FONT, fontSize: '24px', color: '#9cf5d9',
      backgroundColor: '#32465d', padding: { x: 20, y: 11 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', (
      _pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData,
    ) => { event.stopPropagation(); layer.destroy(); });
    layer.add([shade, panel, title, names, close]);
  };
  missionText.setInteractive({ useHandCursor: true }).on('pointerdown', (
    _pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData,
  ) => { event.stopPropagation(); openBoard(); });
  void submitCompetitiveRound(score).then(async (result) => {
    if (!missionText.active) return;
    board = result.board ?? await getWeeklyLeaderboard();
    if (!missionText.active) return;
    const message = result.state === 'saved'
      ? (result.telegramSynced ? '✓ TELEGRAM SCORE SAVED' : '✓ WEEKLY SCORE SAVED')
      : result.state === 'local' ? 'PRACTICE · LOCAL SCORE' : 'SCORE SERVER UNAVAILABLE';
    const top = board?.players?.[0];
    missionText.setText(missionLine + '\n' + message +
      (board ? (top ? ' · TOP: ' + top.name.slice(0, 12) + ' ' + top.score : ' · TOP 10') : '') +
      (board ? ' · TAP' : ''));
  });
  addShareButton(
    scene,
    portrait ? 270 : 239,
    portrait ? 906 : 475,
    portrait ? 270 : 215,
    score,
    summary,
  );
}
/** Shares an explicitly unverified local score, not a server-authoritative result. */
function addShareButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  score: number,
  summary: RoundSummary,
): void {
  const shape = scene.add
    .rectangle(x, y, width, 48, 0x26796d)
    .setStrokeStyle(3, 0xa3edce)
    .setDepth(100)
    .setInteractive({ useHandCursor: true });
  const txt = scene.add
    .text(x, y, isTelegramGame() ? '↗ SHARE GAME' : '↗ SHARE RESULT', {
      fontFamily: FONT,
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#ecfff9',
    })
    .setOrigin(0.5)
    .setDepth(101);
  let busy = false;
  const shareText = scoreShareText(score, summary);
  shape.on(
    'pointerdown',
    (
      _pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (busy) return;
      busy = true;
      const update = (title: string) => {
        txt.setText(title);
        busy = false;
      };
      if (shareTelegramGame()) {
        update('↗ SHARE GAME');
        return;
      }
      const fallback = async () => {
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(shareText);
            update('✓ RESULT COPIED');
          } else {
            window.prompt('Copy your local result:', shareText);
            update('SHARE RESULT');
          }
        } catch {
          update('SHARE RESULT');
        }
      };
      if (typeof navigator.share === 'function') {
        try {
          void navigator
            .share({ title: 'N5 Mustache Mayhem', text: shareText })
            .then(() => update('✓ SHARED'))
            .catch((error: unknown) => {
              if (error instanceof DOMException && error.name === 'AbortError')
                update('SHARE RESULT');
              else void fallback();
            });
        } catch {
          void fallback();
        }
      } else void fallback();
    },
  );
}
