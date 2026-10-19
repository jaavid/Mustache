/** Non-destructive merge of our bot menu commands with any existing commands. */
export const GAME_COMMANDS = [
  { command: 'play', description: '〰️🎯 آماده‌ای رامین رو سیبیلو کنی؟ بزن بریم!' },
  { command: 'leaderboard', description: '〰️🏆 جدول مشترک Classic و Gold Rush؛ روز، هفته، ماه و تاریخ!' },
  { command: 'top', description: '〰️👑 ۱۰ سیبیل‌زن برتر جنگل رو بشناس!' },
  { command: 'score', description: '〰️📈 سیبیلات چند امتیاز آوردن؟ رتبه‌تو ببین!' },
  { command: 'profile', description: '〰️ پروفایل، XP و مرحله طلایی' },
  { command: 'invite', description: '〰️ لینک دعوت دوستان و بوست روزانه' },
  { command: 'wallet', description: '〰️ موجودی و آدرس کیف پول تستی NFIVE' },
  { command: 'rewards', description: '🎁 پاداش‌های هفتگی NFIVE' },
  { command: 'transactions', description: '📜 تاریخچه تراکنش‌های تستی' },
  { command: 'withdraw', description: '↗️ برداشت NFIVE به کیف پول شخصی' },
  { command: 'help', description: '〰️🧭 سیبیل‌اولی؟ فوت‌وفن بازی اینجاست!' },
];

export function mergeBotCommands(existing = []) {
  if (!Array.isArray(existing)) throw new Error('INVALID_BOT_COMMANDS');
  const managed = new Set(GAME_COMMANDS.map(item => item.command));
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
