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
  const match = /^lb:(?:(c|g):)?([dwma]):(0|[1-9]|1[0-2])$/.exec(data);
  if (!match) return null;
  const period = PERIODS[match[2]];
  const offset = Number(match[3]);
  if (period !== 'week' && offset !== 0) return null;
  return { period, offset, mode: 'combined' };
}

export function leaderboardKeyboard(period = 'week', offset = 0) {
  const key = (p, o) => 'lb:' + p + ':' + o;
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
  keyboard.push([{ text: '〰️🎮 بزن بریم سیبیل‌بازی!', url: 'https://t.me/RJTtobot?game=mustache' }]);
  return { inline_keyboard: keyboard };
}

export function formatLeaderboardMessage(board) {
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
      lines.push(rank + ' ' + String(player.name).slice(0, 48) + ' — ' +
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
  return { text: lines.join('\n'), reply_markup: leaderboardKeyboard(board.period, board.offset) };
}
