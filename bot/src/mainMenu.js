/**
 * N5 permanent three-action reply keyboard.
 *
 * Telegram Bot API 9.4 supports style='primary'|'success'|'danger' on
 * KeyboardButton; older clients may ignore button colors.
 * ReplyKeyboardMarkup can be installed only via a sent message and cannot
 * coexist with an inline keyboard on the *same* message.
 */
export const MAIN_BUTTONS = Object.freeze({
  play: '🎮 بازی',
  wallet: '💰 کیف پول',
  help: '🧭 راهنما',
});

export function isPrivateChatOwner(message) {
  return message?.chat?.type === 'private' &&
    Number.isSafeInteger(message.chat.id) &&
    Number.isSafeInteger(message.from?.id) &&
    message.from.id > 0 &&
    message.chat.id === message.from.id;
}

export function parseMainMenuMessage(text) {
  if (typeof text !== 'string') return null;
  const normalized = text.trim();
  for (const [command, label] of Object.entries(MAIN_BUTTONS)) {
    if (normalized === label) return command;
  }
  return null;
}

export function mainReplyKeyboard() {
  return {
    keyboard: [[
      { text: MAIN_BUTTONS.play, style: 'danger' },
      { text: MAIN_BUTTONS.wallet, style: 'success' },
      { text: MAIN_BUTTONS.help, style: 'primary' },
    ]],
    is_persistent: true,
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: '〰️ بازی، کیف پول یا راهنما',
  };
}

/**
 * Installs Telegram's persistent reply keyboard in the private chat.
 * Call only on /start and direct wallet deep links, not every message.
 */
export async function installMainKeyboard(message, send) {
  if (!isPrivateChatOwner(message)) return false;
  await send('sendMessage', {
    chat_id: message.chat.id,
    text: '〰️ منوی سه‌دکمه‌ای سیبیل آماده‌ست! از پایین چت، بازی، کیف پول یا راهنما رو انتخاب کن.',
    reply_markup: mainReplyKeyboard(),
  });
  return true;
}
