/** The public Telegram command menu should be brief; richer flows live behind inline buttons. */
export const GAME_COMMANDS = [
  { command: 'play2', description: '〰️🏠 شروع بازی سیبیل ۲ · قایم‌باشک' },
  { command: 'games', description: '〰️🎮 انتخاب بین بازی‌های سیبیل' },
  { command: 'play', description: '〰️🎮 شروع نبرد سیبیل‌ها!' },
  { command: 'leaderboard', description: '〰️🏆 رتبه‌بندی روز، هفته، ماه و امتیاز من' },
  { command: 'profile', description: '〰️👤 سطح، XP، رکوردها و نشان‌ها' },
  { command: 'invite', description: '〰️🎁 دعوت دوستان و بوست بازی' },
  { command: 'wallet', description: '〰️💰 کیف پول، پاداش‌ها، تراکنش‌ها و برداشت' },
  { command: 'help', description: '〰️🧭 راهنما و دسترسی به امکانات' },
];

// Hide these legacy and administrative commands from the public Telegram picker,
// but retain their existing slash-command handlers and private access checks.
// They may have been registered in BotFather or previous releases.
export const HIDDEN_MENU_COMMANDS = [
  'start', 'top', 'score', 'rewards', 'transactions', 'withdraw',
  'wallethelp', 'admin', 'walletcheck', 'myid',
];

export function mergeBotCommands(existing = []) {
  if (!Array.isArray(existing)) throw new Error('INVALID_BOT_COMMANDS');
  const managed = new Set([...GAME_COMMANDS.map(item => item.command), ...HIDDEN_MENU_COMMANDS]);
  const other = existing.filter(item => item && typeof item.command === 'string' &&
    typeof item.description === 'string' && !managed.has(item.command));
  if (other.length + GAME_COMMANDS.length > 100) throw new Error('BOT_COMMAND_LIMIT');
  return [...GAME_COMMANDS, ...other];
}

export async function syncBotCommands(token, fetcher = fetch) {
  if (typeof token !== 'string' || !/^\d+:[a-zA-Z0-9_-]+$/.test(token)) {
    throw new Error('INVALID_BOT_TOKEN');
  }
  const base = 'https://api.telegram.org/bot' + token + '/';
  const call = async (method, payload = {}) => {
    const response = await fetcher(base + method, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok || body.ok !== true) {
      // Never print Telegram Bot API URLs (contain the secret token).
      throw new Error('BOT_COMMAND_' + method.toUpperCase() + '_FAILED');
    }
    return body.result;
  };
  const current = await call('getMyCommands');
  const next = mergeBotCommands(current);
  if (JSON.stringify(current) === JSON.stringify(next)) return false;
  await call('setMyCommands', { commands: next });
  return true;
}
