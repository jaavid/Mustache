import Phaser from 'phaser';
import { getSelectedGameMode } from '../logic/gameMode';
import {
  getLeaderboard,
  type Board,
  type Period,
  type Submission,
  type Leader,
} from '../platform/competitiveScores';

const FONT = '"Courier New", monospace';
type Tab = Period | 'telegram';
type ScoreboardArgs = {
  score: number;
  submission: Submission;
  initialBoard?: Board;
};

function number(value: number): string {
  return value.toLocaleString('en-US');
}

function telegramMessage(status: Submission['telegramState']): string {
  switch (status) {
    case 'updated':
      return 'TELEGRAM GAME CARD UPDATED';
    case 'previous_best':
      return 'TELEGRAM PREVIOUS HIGH SCORE KEPT';
    case 'retry':
      return 'TELEGRAM UPDATE PENDING';
    default:
      return 'TELEGRAM SCORE NOT UPDATED';
  }
}

/** In-game scoreboard shown automatically after saving an official Telegram round. */
export function showLeaderboardOverlay(
  scene: Phaser.Scene,
  portrait: boolean,
  args: ScoreboardArgs,
): void {
  if (!scene.sys.isActive()) return;
  const w = portrait ? 540 : 960;
  const h = portrait ? 960 : 540;
  const sheet = scene.add.container(0, 0).setDepth(260);
  const surface = scene.add.rectangle(w / 2, h / 2, w, h, 0x080f21, 0.98).setInteractive();
  surface.on(
    'pointerdown',
    (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) =>
      event.stopPropagation(),
  );
  const frame = scene.add
    .rectangle(w / 2, h / 2, portrait ? 516 : 914, portrait ? 842 : 512, 0x152842)
    .setStrokeStyle(3, 0xe4ba6c);
  sheet.add([surface, frame]);
  const addText = (
    x: number,
    y: number,
    content: string,
    size: number,
    color: string,
    align: 'left' | 'center' = 'center',
  ): Phaser.GameObjects.Text => {
    const obj = scene.add
      .text(x, y, content, {
        fontFamily: FONT,
        fontSize: size + 'px',
        color,
        fontStyle: 'bold',
        align,
        stroke: '#0d152c',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    sheet.add(obj);
    return obj;
  };
  const button = (
    x: number,
    y: number,
    width: number,
    content: string,
    onClick: () => void,
    tint = 0x324a63,
  ): void => {
    const hit = scene.add
      .rectangle(x, y, width, 34, tint)
      .setStrokeStyle(2, 0x90b6c0)
      .setInteractive({ useHandCursor: true });
    const label = scene.add
      .text(x, y, content, {
        fontFamily: FONT,
        fontSize: portrait ? '15px' : '16px',
        color: '#f3ffe5',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    sheet.add([hit, label]);
    hit.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        onClick();
      },
    );
  };
  addText(w / 2, portrait ? 116 : 42, getSelectedGameMode() === 'goldRush' ? 'GOLD RUSH · LEADERBOARDS' : 'MUSTACHE · LEADERBOARDS', portrait ? 25 : 26, '#ffda90');
  addText(w / 2, portrait ? 163 : 82, 'YOUR ROUND: ' + number(args.score), 23, '#f7fff2');
  const stateLine =
    args.submission.state === 'saved'
      ? telegramMessage(args.submission.telegramState)
      : args.submission.state === 'unavailable'
        ? 'NOT SAVED · ' + (args.submission.error || 'UNKNOWN_ERROR')
        : 'PRACTICE SCORE · NOT UPLOADED';
  addText(w / 2, portrait ? 203 : 116, stateLine, portrait ? 16 : 15, '#a9f5d5');
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'day', label: 'DAY' },
    { key: 'week', label: 'WEEK' },
    { key: 'month', label: 'MONTH' },
    { key: 'all', label: 'ALL' },
    { key: 'telegram', label: 'TG CHAT' },
  ];
  let active: Tab = 'week';
  let offset = 0;
  let requestNumber = 0;
  let current: Board | undefined = args.initialBoard;
  let loading = false;
  const periodLine = addText(w / 2, portrait ? 323 : 175, '', portrait ? 15 : 15, '#edd6ad');
  const listText = addText(
    w / 2,
    portrait ? 483 : 328,
    '',
    portrait ? 18 : 17,
    '#e7fff1',
    'left',
  ).setOrigin(0.5);
  const ownLine = addText(w / 2, portrait ? 676 : 451, '', portrait ? 17 : 16, '#f9e6a5');
  const infoLine = addText(w / 2, portrait ? 715 : 472, '', portrait ? 14 : 14, '#b6cadb');
  const buttonY = portrait ? 268 : 146;

  function render(): void {
    if (!sheet.active) return;
    if (active === 'telegram') {
      periodLine.setText('OFFICIAL TELEGRAM GAME CARD · CHAT-LOCAL / ALL-TIME');
      const rows = args.submission.telegramScores || [];
      listText.setText(
        rows.length
          ? rows.slice(0, 10).map(formatRow).join('\n')
          : 'TELEGRAM HAS NO SCOREBOARD RESPONSE',
      );
      ownLine.setText(telegramMessage(args.submission.telegramState));
      infoLine.setText('TELEGRAM RETURNS TOP SCORES AND NEARBY PLAYERS');
      return;
    }
    if (!current) {
      periodLine.setText(
        loading ? 'LOADING TEHRAN SCOREBOARD...' : 'SCOREBOARD TEMPORARILY UNAVAILABLE',
      );
      listText.setText('');
      ownLine.setText('');
      infoLine.setText('');
      return;
    }
    periodLine.setText(current.startLabel || 'ALL TIME');
    listText.setText(
      current.players.length
        ? current.players.slice(0, 10).map(formatRow).join('\n')
        : 'NO SCORES FOR THIS PERIOD',
    );
    ownLine.setText(
      current.me
        ? 'YOUR RANK: #' +
            number(current.me.rank) +
            ' · ' +
            number(current.me.score) +
            ' PTS' + (current.me.boostPoints ? ' (+' + number(current.me.boostPoints) + ' INVITE)' : '') +
            (current.me.goldenPerfect ? ' ★ GOLD' : '')
        : 'YOUR RANK: NO RECORDED SCORE',
    );
    const left = current.remainingSeconds;
    const remaining = left !== null ? ' · ' + Math.max(0, Math.ceil(left / 3600)) + 'H LEFT' : '';
    infoLine.setText(number(current.playerCount) + ' PLAYERS · ASIA/TEHRAN' + remaining +
      (current.rival && current.me ? ' · BEAT #' + current.rival.rank + ' IN ' +
      Math.max(0, current.rival.score - current.me.score + 1) + ' PTS' : ''));
  }
  function formatRow(row: Leader): string {
    return (
      '#' +
      String(row.rank).padStart(2, '0') +
      '  ' +
      row.name.slice(0, portrait ? 13 : 18).padEnd(portrait ? 13 : 18) +
      '  ' +
      number(row.score) +
      (row.goldenPerfect ? ' ★' : '')
    );
  }
  async function activate(tab: Tab, weekOffset = 0): Promise<void> {
    active = tab;
    offset = tab === 'week' ? weekOffset : 0;
    const seq = ++requestNumber;
    if (tab === 'telegram') {
      render();
      return;
    }
    if (tab !== 'week' || offset !== 0 || !args.initialBoard) current = undefined;
    else current = args.initialBoard;
    loading = !current;
    render();
    const board = current || (await getLeaderboard(tab, offset, args.submission.mode || getSelectedGameMode()));
    if (seq !== requestNumber || !sheet.active) return;
    current = board;
    loading = false;
    render();
  }
  tabs.forEach((tab, i) => {
    const x = portrait ? 58 + i * 106 : 198 + i * 141;
    button(x, buttonY, portrait ? 98 : 128, tab.label, () => void activate(tab.key));
  });
  button(
    portrait ? 91 : 195,
    portrait ? 757 : 498,
    portrait ? 138 : 158,
    '◀ PREV WEEK',
    () => void activate('week', Math.min(offset + 1, 12)),
  );
  button(
    portrait ? 256 : 388,
    portrait ? 757 : 498,
    portrait ? 138 : 158,
    'NEXT WEEK ▶',
    () => void activate('week', Math.max(offset - 1, 0)),
  );
  button(
    portrait ? 429 : 764,
    portrait ? 757 : 498,
    portrait ? 138 : 158,
    '✕ CLOSE',
    () => sheet.destroy(),
    0x315f57,
  );
  // For ease of reading, the Game result remains visible behind this dismissible overlay.
  void activate('week', 0);
}
