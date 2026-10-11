/** Interactive Telegram chat leaderboard, backed by the same D1 period queries as Phaser. */
const BUTTONS = [
  [{ text: '☀️ امروز', callback_data: 'lb:d:0' }, { text: '🏆 این هفته', callback_data: 'lb:w:0' }],
  [{ text: '🗓 ماه شمسی', callback_data: 'lb:m:0' }, { text: '⭐ کل دوران', callback_data: 'lb:a:0' }],
];
const PERIODS = { d: 'day', w: 'week', m: 'month', a: 'all' };
const TITLES = {
  day: 'امروز',
  week: 'هفته (شنبه تا شنبه)',
  month: 'ماه شمسی',
  all: 'کل دوران',
};

export function parseLeaderboardCallback(data) {
  if (typeof data !== 'string') return null;
  const match = /^lb:([dwma]):(0|[1-9]|1[0-2])$/.exec(data);
  if (!match) return null;
  const period = PERIODS[match[1]];
  const offset = Number(match[2]);
  if (period !== 'week' && offset !== 0) return null;
  return { period, offset };
}

export function leaderboardKeyboard(period = 'week', offset = 0) {
  const keyboard = BUTTONS.map(row => row.map(button => ({ ...button })));
  if (period === 'week') {
    const move = [];
    if (offset < 12) move.push({ text: '◀️ هفته قبل', callback_data: 'lb:w:' + (offset + 1) });
    if (offset > 0) move.push({ text: 'هفته بعد ▶️', callback_data: 'lb:w:' + (offset - 1) });
    if (move.length) keyboard.push(move);
  }
  keyboard.push([{ text: '〰️🎮 بزن بریم سیبیل‌بازی!', url: 'https://t.me/RJTtobot?game=mustache' }]);
  return { inline_keyboard: keyboard };
}

export function formatLeaderboardMessage(board) {
  const title = TITLES[board.period] || TITLES.week;
  const lines = [
    '〰️🏆 نبرد سیبیل‌سالارها',
    '📊 ' + title,
    board.startLabel || 'تمام دوران',
    '',
  ];
  if (board.players.length) {
    board.players.slice(0, 10).forEach(player => {
      lines.push(String(player.rank).padStart(2, '0') + '. ' +
        String(player.name).slice(0, 48) + ' — ' + Number(player.score).toLocaleString('en-US') + (Number(player.goldenPerfect || 0) > 0 ? ' 🥇' : ''));
    });
  } else {
    lines.push('هنوز امتیازی برای این بازه ثبت نشده است.');
  }
  lines.push('', '👥 بازیکنان: ' + Number(board.playerCount).toLocaleString('en-US'));
  if ('me' in board) {
    lines.push(board.me
      ? '🎯 رتبه شما: ' + board.me.rank + ' · ' + Number(board.me.score).toLocaleString('en-US') + ' امتیاز' + (Number(board.me.goldenPerfect || 0) > 0 ? ' 🥇' : '')
      : '🎯 در این بازه هنوز امتیازی ثبت نکرده‌اید.');
  }
  if (board.period === 'week') {
    lines.push('⏰ از شنبه ۰۰:۰۰ تا شنبه بعد ۰۰:۰۰ به وقت تهران');
    if (board.offset > 0) lines.push('📁 هفته‌های گذشته · ' + board.offset + ' هفته قبل');
  }
  lines.push('', '〰️ جدول دیگه‌ای می‌خوای؟ روی دکمه‌ها بزن!');
  return { text: lines.join('\n'), reply_markup: leaderboardKeyboard(board.period, board.offset) };
}
