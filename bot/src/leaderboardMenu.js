/** Interactive Telegram leaderboard for both modes, using the same D1 query as Phaser. */
const PERIODS = { d: 'day', w: 'week', m: 'month', a: 'all' };
const TITLES = {
  day: 'امروز',
  week: 'هفته (شنبه تا شنبه)',
  month: 'ماه شمسی',
  all: 'کل دوران',
};
const PERIOD_BUTTONS = [
  [{ text: '☀️ امروز', code: 'd' }, { text: '🏆 این هفته', code: 'w' }],
  [{ text: '🗓 ماه شمسی', code: 'm' }, { text: '⭐ کل دوران', code: 'a' }],
];

/** Accept old mode-aware callbacks; every button opens the unified board. */
export function parseLeaderboardCallback(data) {
  if (typeof data !== 'string') return null;
  const match = /^lb:(?:(c|g|r|t):)?([dwma]):(0|[1-9]|1[0-2])$/.exec(data);
  if (!match) return null;
  const period = PERIODS[match[2]];
  const offset = Number(match[3]);
  if (period !== 'week' && offset !== 0) return null;
  return { period, offset, mode: 'combined', ...(match[1] === 't' ? { presentation: 'text' } : {}) };
}

const PERIOD_CODES = { day: 'd', week: 'w', month: 'm', all: 'a' };
const codeForPeriod = period => PERIOD_CODES[period] || 'w';

export function leaderboardKeyboard(period = 'week', offset = 0, presentation = 'rich') {
  const prefix = presentation === 'text' ? 'lb:t:' : 'lb:';
  const key = (p, o) => prefix + p + ':' + o;
  const keyboard = [
    ...PERIOD_BUTTONS.map(row => row.map(button => ({
      text: button.text,
      callback_data: key(button.code, 0),
    }))),
  ];
  if (period === 'week') {
    const move = [];
    if (offset < 12) move.push({ text: '◀️ هفته قبل', callback_data: key('w', offset + 1) });
    if (offset > 0) move.push({ text: 'هفته بعد ▶️', callback_data: key('w', offset - 1) });
    if (move.length) keyboard.push(move);
  }
  keyboard.push([{
    text: presentation === 'text' ? '✨ جدول ریچ' : '📄 نمایش متنی',
    callback_data: 'lb:' + (presentation === 'text' ? 'r:' : 't:') + codeForPeriod(period) + ':' + offset,
  }]);
  keyboard.push([{ text: '〰️🎮 بزن بریم سیبیل‌بازی!', url: 'https://t.me/RJTtobot?game=mustache' }]);
  return { inline_keyboard: keyboard };
}

/** Names are plain data, not Markdown. Strip controls that could fake extra rows or reverse text. */
function safePlayerName(name, limit = 48) {
  return String(name ?? 'Player')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit) || 'Player';
}

export function formatLeaderboardMessage(board, presentation = 'text') {
  const title = TITLES[board.period] || TITLES.week;
  const lines = [
    '〰️🏆 نبرد سیبیل‌سالارها',
    '🎮 Classic + 🪙 Gold Rush · 📊 ' + title,
    board.startLabel || 'تمام دوران',
    '',
  ];
  if (board.players.length) {
    board.players.slice(0, 10).forEach(player => {
      const medal = ['🥇', '🥈', '🥉'][Number(player.rank) - 1];
      const rank = medal || String(player.rank).padStart(2, '0') + '.';
      const mode = player.mode === 'goldRush' ? '🪙' : '🎮';
      const golden = Number(player.goldenPerfect || 0) > 0 ? ' 〰️✨' : '';
      lines.push(rank + ' ' + safePlayerName(player.name) + ' — ' +
        Number(player.score).toLocaleString('en-US') + ' ' + mode + golden);
    });
  } else {
    lines.push('هنوز امتیازی برای این بازه ثبت نشده است.');
  }
  lines.push('', '🎮 کلاسیک · 🪙 گلدراش · 〰️✨ سیبیل طلایی پرفکت');
  lines.push('👥 بازیکنان دارای امتیاز معتبر در این جدول: ' +
    Number(board.playerCount).toLocaleString('en-US'));
  if ('me' in board) {
    lines.push(board.me
      ? '🎯 رتبه شما: ' + board.me.rank + ' · ' + Number(board.me.score).toLocaleString('en-US') +
        ' امتیاز · ' + (board.me.mode === 'goldRush' ? '🪙' : '🎮') +
        (Number(board.me.goldenPerfect || 0) > 0 ? ' 〰️✨' : '')
      : '🎯 در این بازه هنوز امتیازی ثبت نکرده‌اید.');
  }
  if (board.period === 'week') {
    lines.push('⏰ از شنبه ۰۰:۰۰ تا شنبه بعد ۰۰:۰۰ به وقت تهران');
    if (board.offset > 0) lines.push('📁 هفته‌های گذشته · ' + board.offset + ' هفته قبل');
  }
  lines.push('', '〰️ جدول دیگه‌ای می‌خوای؟ روی دکمه‌ها بزن!');
  return { text: lines.join('\n'), reply_markup: leaderboardKeyboard(board.period, board.offset, presentation) };
}

/** Bot API 10.2+ typed blocks; user-supplied names never pass through Markdown/HTML. */
export function formatRichLeaderboardMessage(board) {
  const title = TITLES[board.period] || TITLES.week;
  const paragraph = text => ({ type: 'paragraph', text });
  const blocks = [
    { type: 'heading', size: 2, text: '〰️🏆 نبرد سیبیل‌سالارها' },
    paragraph('🎮 Classic + 🪙 Gold Rush · 📊 ' + title),
    paragraph(board.startLabel || 'تمام دوران'),
  ];
  if (board.players.length) {
    const cell = (text, align = 'right', isHeader = false) => ({
      text, align, ...(isHeader ? { is_header: true } : {}),
    });
    const rows = [[
      cell('رتبه', 'center', true),
      cell('بازیکن', 'right', true),
      cell('امتیاز', 'right', true),
      cell('نشان', 'center', true),
    ]];
    for (const player of board.players.slice(0, 10)) {
      const rank = ['🥇', '🥈', '🥉'][Number(player.rank) - 1] ||
        String(player.rank).padStart(2, '0');
      const badges = (player.mode === 'goldRush' ? '🪙' : '🎮') +
        (Number(player.goldenPerfect || 0) > 0 ? ' 〰️✨' : '');
      rows.push([
        cell(rank, 'center'),
        cell(safePlayerName(player.name, 24)),
        cell(Number(player.score).toLocaleString('en-US')),
        cell(badges, 'center'),
      ]);
    }
    blocks.push({
      type: 'table', cells: rows, is_bordered: true, is_striped: true, is_compact: true,
    });
  } else {
    blocks.push(paragraph('هنوز امتیازی برای این بازه ثبت نشده است.'));
  }
  blocks.push(
    { type: 'divider' },
    paragraph('🎮 کلاسیک · 🪙 گلدراش · 〰️✨ سیبیل طلایی پرفکت'),
    paragraph('👥 بازیکنان دارای امتیاز معتبر: ' +
      Number(board.playerCount).toLocaleString('en-US')),
  );
  if ('me' in board) {
    blocks.push(paragraph(board.me
      ? '🎯 رتبه شما: ' + board.me.rank + ' · ' +
        Number(board.me.score).toLocaleString('en-US') + ' امتیاز · ' +
        (board.me.mode === 'goldRush' ? '🪙' : '🎮') +
        (Number(board.me.goldenPerfect || 0) > 0 ? ' 〰️✨' : '')
      : '🎯 در این بازه هنوز امتیازی ثبت نکرده‌اید.'));
  }
  if (board.period === 'week') {
    blocks.push(paragraph('⏰ شنبه ۰۰:۰۰ تا شنبه بعد ۰۰:۰۰ به وقت تهران'));
    if (board.offset > 0) {
      blocks.push(paragraph('📁 هفته‌های گذشته · ' + board.offset + ' هفته قبل'));
    }
  }
  blocks.push(paragraph('〰️ جدول دیگه‌ای می‌خوای؟ روی دکمه‌ها بزن!'));
  return {
    rich_message: { blocks, is_rtl: true, skip_entity_detection: true },
    reply_markup: leaderboardKeyboard(board.period, board.offset, 'rich'),
  };
}
