/** One compact combined leaderboard for Classic + Gold Rush; full details stay opt-in. */
const PERIODS = { d: 'day', w: 'week', m: 'month', a: 'all' };
const TITLES = {
  day: 'روزانه', week: 'هفتگی', month: 'ماهانه', all: 'کامل',
};
const PERIOD_BUTTONS = [
  [{ text: 'روزانه', code: 'd' }, { text: 'هفتگی', code: 'w' }],
  [{ text: 'ماهانه', code: 'm' }, { text: 'کامل', code: 'a' }],
];
const PERIOD_CODES = { day: 'd', week: 'w', month: 'm', all: 'a' };
const codeForPeriod = period => PERIOD_CODES[period] || 'w';

/**
 * Legacy c/g callbacks remain unified. r = compact rich, t = compact text,
 * v = expanded rich, u = expanded text. No offset except historic weeks (0..12).
 */
export function parseLeaderboardCallback(data) {
  if (typeof data !== 'string') return null;
  const match = /^lb:(?:(c|g|r|t|v|u):)?([dwma]):(0|[1-9]|1[0-2])$/.exec(data);
  if (!match) return null;
  const period = PERIODS[match[2]];
  const offset = Number(match[3]);
  if (period !== 'week' && offset !== 0) return null;
  const presentation = ['t', 'u'].includes(match[1]) ? 'text' : undefined;
  return {
    period, offset, mode: 'combined',
    ...(presentation ? { presentation } : {}),
    ...(['v','u'].includes(match[1]) ? { expanded: true } : {}),
  };
}

/**
 * Four public period buttons always show the same precise Persian labels.
 * Details, historic weeks and plaintext toggle are secondary choices.
 * No Play/Wallet/Help buttons: the persistent Telegram reply keyboard owns them.
 */
export function leaderboardKeyboard(period = 'week', offset = 0, presentation = 'rich', expanded = false) {
  const code = codeForPeriod(period);
  const viewCode = (p, o = 0, full = false, text = presentation === 'text') =>
    'lb:' + (full ? (text ? 'u:' : 'v:') : (text ? 't:' : '')) + p + ':' + o;
  const keyboard = PERIOD_BUTTONS.map(row => row.map(item => ({
    text: item.text, callback_data: viewCode(item.code),
  })));
  if (!expanded) {
    keyboard.push([{ text: '📋 جزئیات و جدول ۱۰ نفره', callback_data: viewCode(code, offset, true) }]);
  } else {
    if (period === 'week') {
      const archive = [];
      if (offset < 12) archive.push({
        text: '◀️ هفته قبل', callback_data: viewCode('w', offset + 1, true),
      });
      if (offset > 0) archive.push({
        text: 'هفته بعد ▶️', callback_data: viewCode('w', offset - 1, true),
      });
      if (archive.length) keyboard.push(archive);
    }
    keyboard.push([
      { text: '🔼 نمایش خلاصه', callback_data: viewCode(code, offset, false) },
      { text: presentation === 'text' ? '✨ نمایش جدولی' : '📄 نمایش متنی',
        callback_data: viewCode(code, offset, true, presentation !== 'text') },
    ]);
  }
  return { inline_keyboard: keyboard };
}

/** Usernames are always plain data, not Markdown; strip controls and Bidi markers. */
function safePlayerName(name, limit = 48) {
  return String(name ?? 'Player')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit) || 'Player';
}
const rankMark = rank => ['🥇', '🥈', '🥉'][Number(rank) - 1] ||
  String(rank).padStart(2, '0') + '.';
const badges = player => (player.mode === 'goldRush' ? '🪙' : '🎮') +
  (Number(player.goldenPerfect || 0) > 0 ? ' 〰️✨' : '');
const points = score => Number(score).toLocaleString('en-US');
const boardPlayers = (board, expanded) => board.players.slice(0, expanded ? 10 : 5);
const playerSummary = board => !('me' in board) ? null : board.me
  ? '🎯 رتبه شما: ' + board.me.rank + ' · ' + points(board.me.score) + ' امتیاز · ' + badges(board.me)
  : '🎯 هنوز امتیازی در این بازه ثبت نکرده‌اید.';

export function formatLeaderboardMessage(board, presentation = 'text', expanded = false) {
  const title = TITLES[board.period] || TITLES.week;
  const lines = [
    '〰️🏆 رتبه‌بندی ' + title,
    board.startLabel || 'تمام دوران',
    '',
  ];
  if (board.players.length) {
    for (const player of boardPlayers(board, expanded)) {
      lines.push(rankMark(player.rank) + ' ' + safePlayerName(player.name, 24) + ' — ' +
        points(player.score) + ' ' + badges(player));
    }
  } else lines.push('هنوز امتیازی برای این بازه ثبت نشده است.');
  const me = playerSummary(board);
  if (me) lines.push('', me);
  lines.push('👥 ' + points(board.playerCount) + ' بازیکن');
  if (expanded) {
    lines.push('🎮 کلاسیک · 🪙 گلدراش · 〰️✨ سیبیل طلایی پرفکت');
    if (board.period === 'week') {
      lines.push('⏰ شنبه ۰۰:۰۰ تا شنبه بعد ۰۰:۰۰ به وقت تهران');
      if (board.offset > 0) lines.push('📁 ' + board.offset + ' هفته قبل');
    }
  }
  return {
    text: lines.join('\n'),
    reply_markup: leaderboardKeyboard(board.period, board.offset, presentation, expanded),
  };
}

/** Telegram Bot API 10.2+ typed blocks: compact = 5 players, details = 10. */
export function formatRichLeaderboardMessage(board, { expanded = false } = {}) {
  const title = TITLES[board.period] || TITLES.week;
  const paragraph = text => ({ type: 'paragraph', text });
  const blocks = [
    { type: 'heading', size: 2, text: '〰️🏆 رتبه‌بندی ' + title },
    paragraph(board.startLabel || 'تمام دوران'),
  ];
  if (board.players.length) {
    const cell = (text, align = 'right', isHeader = false) => ({
      text, align, ...(isHeader ? { is_header: true } : {}),
    });
    const headers = expanded
      ? ['رتبه', 'بازیکن', 'امتیاز', 'نشان']
      : ['رتبه', 'بازیکن', 'امتیاز'];
    const rows = [headers.map((item, i) => cell(item, i === 0 ? 'center' : 'right', true))];
    for (const player of boardPlayers(board, expanded)) {
      const row = [
        cell(rankMark(player.rank).replace(/\.$/, ''), 'center'),
        cell(safePlayerName(player.name, expanded ? 24 : 18)),
        cell(points(player.score) + (expanded ? '' : ' ' + badges(player))),
      ];
      if (expanded) row.push(cell(badges(player), 'center'));
      rows.push(row);
    }
    blocks.push({ type: 'table', cells: rows,
      is_bordered: expanded, is_striped: true, is_compact: true });
  } else blocks.push(paragraph('هنوز امتیازی برای این بازه ثبت نشده است.'));
  const me = playerSummary(board);
  if (me) blocks.push(paragraph(me));
  blocks.push(paragraph('👥 ' + points(board.playerCount) + ' بازیکن'));
  if (expanded) {
    blocks.push(paragraph('🎮 Classic + 🪙 Gold Rush · 〰️✨ سیبیل طلایی پرفکت'));
    if (board.period === 'week') {
      blocks.push(paragraph('⏰ شنبه ۰۰:۰۰ تا شنبه بعد ۰۰:۰۰ به وقت تهران'));
      if (board.offset > 0) blocks.push(paragraph('📁 ' + board.offset + ' هفته قبل'));
    }
  }
  return {
    rich_message: { blocks, is_rtl: true, skip_entity_detection: true },
    reply_markup: leaderboardKeyboard(board.period, board.offset, 'rich', expanded),
  };
}
