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
import { submitCompetitiveRound, getLeaderboard } from '../platform/competitiveScores';
import { showLeaderboardOverlay } from './leaderboardOverlay';

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
  const statusText = scene.add
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
    .setDepth(91)
    .setInteractive({ useHandCursor: true });
  let displayBoard = () => { /* registered when the API responds */ };
  statusText.on('pointerdown', (
    _pointer: Phaser.Input.Pointer,
    _x: number,
    _y: number,
    event: Phaser.Types.Input.EventData,
  ) => {
    event.stopPropagation();
    displayBoard();
  });
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
  void submitCompetitiveRound(score).then(async (result) => {
    if (!statusText.active) return;
    const board = result.board ?? (await getLeaderboard('week'));
    if (!statusText.active) return;
    const status = result.state === 'saved'
      ? result.telegramState === 'updated'
        ? '✓ TELEGRAM SCORE REGISTERED'
        : result.telegramState === 'previous_best'
          ? '✓ SAVED · PREVIOUS TG HIGH KEPT'
          : '✓ D1 SAVED · TELEGRAM PENDING'
      : result.state === 'local'
        ? 'PRACTICE · LOCAL SCORE'
        : 'SCORE SERVER UNAVAILABLE';
    statusText.setText(missionLine + '\n' + status + ' · VIEW TOP 10');
    displayBoard = () => showLeaderboardOverlay(scene, portrait, {
      score, submission: result, initialBoard: board,
    });
    // For official Telegram rounds, show the scoreboard without requiring an extra tap.
    if (result.state === 'saved') displayBoard();
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
