// Telegram wallet interface. All identities originate from the verified bot webhook,
// never client-provided user IDs or forwarded messages.
const ERROR_MESSAGE = '〰️ سرویس کیف پول موقتاً در دسترس نیست. کمی بعد دوباره امتحان کن.';
const paragraph = text => ({ type: 'paragraph', text });
const heading = text => ({ type: 'heading', size: 2, text });
const divider = () => ({ type: 'divider' });
const button = (text, action) => ({ text, callback_data: 'nw:' + action });
const TG_WALLET_LINK = 'https://t.me/RJTtobot?start=wallet';
const GAME_LINK = 'https://t.me/RJTtobot?game=mustache';
export const WITHDRAW_EXAMPLE = '/withdraw 25 0xYourPolygonAddress';
const copyButton = (label, value) => ({
  text: label,
  copy_text: { text: value },
  style: 'primary',
});
function withdrawCopyKeyboard() {
  const keyboard = walletKeyboard();
  keyboard.inline_keyboard.unshift([
    copyButton('📋 کپی نمونه دستور برداشت', WITHDRAW_EXAMPLE),
  ]);
  return keyboard;
}
const AMOY_FAUCET_URL = 'https://faucet.polygon.technology/';

function safe(value, max = 80) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().slice(0, max);
}
function isRichUnsupported(error) {
  return error instanceof Error && error.message === 'TELEGRAM_RICH_UNSUPPORTED';
}
function isNoChange(error) {
  return error instanceof Error && error.message === 'TELEGRAM_MESSAGE_NOT_MODIFIED';
}
export function isPrivateOwner(chat, user) {
  return chat?.type === 'private' && Number.isSafeInteger(chat.id) &&
    Number.isSafeInteger(user?.id) && user.id > 0 && chat.id === user.id;
}
function walletKeyboard() {
  return { inline_keyboard: [
    [button('💰 کیف پول', 'w'), button('🎁 پاداش‌ها', 'r')],
    [button('📜 تراکنش‌ها', 't'), button('↗️ راهنمای برداشت', 'x')],
    [button('⛽ POL تستی (Faucet)', 'f'), button('🧭 راهنما', 'm')],
    [{ text: '〰️🎮 بازی', url: GAME_LINK }],
  ] };
}
function format(amountRaw, decimals = 18) {
  const d = Number(decimals);
  if (!Number.isInteger(d) || d < 0 || d > 36 || !/^[0-9]+$/.test(String(amountRaw))) return '—';
  const value = BigInt(amountRaw).toString().padStart(d + 1, '0');
  return d ? value.slice(0, -d) + '.' + value.slice(-d).replace(/0+$/, '').replace(/^$/, '0') : value;
}
function validHash(value) {
  return typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) ? value : null;
}
function validAddress(value) {
  return typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) ? value : null;
}
function stateName(code) {
  return ({
    PLANNED: 'برنامه‌ریزی‌شده', APPROVED: 'تأیید شده', SIGNED: 'امضاشده',
    SUBMITTED: 'در انتظار شبکه', CONFIRMED: 'تأییدشده', FAILED: 'ناموفق',
    REVIEW_REQUIRED: 'نیازمند بررسی', COMPLETE: 'تکمیل‌شده',
    AWAITING_CONFIRMATION: 'منتظر تأیید شما', READY: 'در صف',
    GAS_PENDING: 'در حال تأمین کارمزد', TOKEN_PENDING: 'در حال انتقال',
    CANCELLED: 'لغوشده',
  })[code] || 'در انتظار پردازش';
}
function table(headers, rows) {
  const cell = (text, isHeader = false) => ({
    text: safe(text, 90), align: 'right', ...(isHeader ? { is_header: true } : {}),
  });
  return {
    type: 'table', is_bordered: true, is_striped: true, is_compact: true,
    cells: [headers.map(s => cell(s, true)), ...rows.map(r => r.map(s => cell(s)))],
  };
}
function response(blocks, text, reply_markup = walletKeyboard()) {
  return { rich: { rich_message: { blocks, is_rtl: true, skip_entity_detection: true }, reply_markup },
    fallback: { text, reply_markup } };
}
function intro() {
  const content = [
    '〰️💼 مرکز کیف پول N5', '',
    '💰 /wallet — موجودی و آدرس',
    '🎁 /rewards — پاداش‌های بازی',
    '📜 /transactions — تاریخچه آنچین',
    '↗️ /withdraw AMOUNT 0xADDRESS — درخواست برداشت', '',
    '🌐 شبکه: Polygon Amoy Testnet',
    '⛽ کارمزد برداشت را N5 تأمین می‌کند.',
    '🔗 برای دریافت POL تستیِ Gas از دکمه Faucet استفاده کن؛ Faucet توکن tNFIVE نمی‌دهد.',
    '⚠️ توکن‌ها آزمایشی هستند و ارزش مالی ندارند.',
  ].join('\n');
  return response([
    heading('〰️💼 مرکز کیف پول N5'),
    paragraph('Polygon Amoy · tNFIVE آزمایشی'),
    divider(),
    paragraph('💰 کیف پول · 🎁 پاداش‌ها · 📜 تاریخچه'),
    paragraph('↗️ برداشت: /withdraw 25 0xADDRESS'),
    paragraph('⛽ تأمین کارمزد برداشت با N5 است؛ Faucet فقط POL تستی می‌دهد، نه tNFIVE.'),
    paragraph('⚠️ دارایی‌ها صرفاً آزمایشی‌اند.'),
  ], content);
}
function accountView(wallet) {
  const address = validAddress(wallet?.address);
  if (!address) throw new Error('INVALID_WALLET_RESPONSE');
  const balance = safe(wallet.balance, 48);
  const pol = safe(wallet.pol, 48);
  const symbol = safe(wallet.symbol, 18) || 'tNFIVE';
  const explorer = 'https://amoy.polygonscan.com/address/' + address;
  const keyboard = walletKeyboard();
  keyboard.inline_keyboard.splice(0, 0,
    [copyButton('📋 کپی آدرس کیف پول', address)],
    [{ text: '🔗 مشاهده در Polygonscan', url: explorer }]);
  const fallback = [
    '〰️💰 کیف پول N5', '',
    'موجودی: ' + balance + ' ' + symbol,
    'POL: ' + pol,
    '🌐 Polygon Amoy (80002)', '',
    'آدرس اختصاصی شما:', address,
    '', '⛽ کارمزد برداشت با N5 است.',
    '🔗 ' + explorer,
    '⚠️ توکن آزمایشی؛ ارزش مالی ندارد.',
  ].join('\n');
  return response([
    heading('〰️💰 کیف پول N5'),
    paragraph('شبکه آزمایشی Polygon Amoy · Chain 80002'),
    table(['دارایی', 'موجودی'], [[symbol, balance], ['POL (Gas)', pol]]),
    divider(),
    paragraph('🏦 آدرس اختصاصی شما (دکمه «کپی آدرس» در پایین پیام):'),
    paragraph(address),
    paragraph('⛽ هزینه برداشت آزمایشی را N5 پرداخت می‌کند.'),
    paragraph('برای POL تستیِ تراکنش‌های بعدی، دکمه Faucet را بزن. Faucet توکن tNFIVE ارائه نمی‌کند.'),
    paragraph('⚠️ این توکن تستی است.'),
  ], fallback, keyboard);
}
function historyView(data, mode) {
  const rewards = Array.isArray(data?.rewards) ? data.rewards : [];
  const withdrawals = Array.isArray(data?.withdrawals) ? data.withdrawals : [];
  const isRewards = mode === 'r';
  const rows = isRewards
    ? rewards.slice(0, 8).map(x => ({
      title: safe(x.batchId, 55), amount: format(x.amountRaw, x.decimals),
      state: stateName(x.state || 'PLANNED'), hash: validHash(x.txHash),
    }))
    : [
      ...rewards.slice(0, 7).map(x => ({
        title: '🎁 ' + safe(x.batchId, 50), amount: format(x.amountRaw, x.decimals),
        state: stateName(x.state || 'PLANNED'), hash: validHash(x.txHash),
      })),
      ...withdrawals.slice(0, 7).map(x => ({
        title: '↗️ برداشت', amount: format(x.amountRaw, 18),
        state: stateName(x.state), hash: validHash(x.txHash),
      })),
    ].slice(0, 12);
  const name = isRewards ? '🎁 پاداش‌های من' : '📜 تاریخچه کیف پول';
  const lines = ['〰️' + name, '', rows.length ? '' : 'هنوز موردی ثبت نشده است.'];
  const blocks = [heading('〰️' + name), paragraph('شبکه Polygon Amoy · tNFIVE تستی')];
  if (rows.length) {
    blocks.push(table(['عملیات', 'tNFIVE', 'وضعیت'], rows.map(x => [x.title, x.amount, x.state])));
    for (const x of rows) {
      lines.push(x.title + ' | ' + x.amount + ' tNFIVE | ' + x.state);
      if (x.hash) lines.push('https://amoy.polygonscan.com/tx/' + x.hash);
    }
    const hashes = rows.filter(x => x.hash);
    if (hashes.length) {
      blocks.push(divider());
      blocks.push(paragraph('🔗 تراکنش‌های ثبت‌شده در Amoy:'));
      for (const x of hashes.slice(0, 4)) {
        blocks.push(paragraph(x.title + ': https://amoy.polygonscan.com/tx/' + x.hash));
      }
    }
  } else blocks.push(paragraph('هنوز تراکنش یا پاداشی ثبت نشده است.'));
  blocks.push(paragraph('📌 تأییدشده یعنی رسید تراکنش روی شبکه ثبت شده است.'));
  const keys=walletKeyboard();
  const links=rows.filter(x=>x.hash).slice(0,3)
    .map((x,i)=>[{text:'🔗 رسید تراکنش '+(i+1),url:'https://amoy.polygonscan.com/tx/'+x.hash}]);
  if (links.length) keys.inline_keyboard.unshift(...links);
  return response(blocks, lines.join('\n'),keys);
}
function faucetGuide(wallet) {
  const address = validAddress(wallet?.address);
  if (!address) throw new Error('INVALID_WALLET_RESPONSE');
  const keyboard = walletKeyboard();
  keyboard.inline_keyboard.unshift(
    [copyButton('📋 کپی آدرس کیف پول', address)],
    [{ text: '⛽ بازکردن Polygon Faucet', url: AMOY_FAUCET_URL }]);
  const content = [
    '〰️⛽ دریافت POL تستی برای Polygon Amoy', '',
    '۱. وارد سایت رسمی Polygon Faucet شو.',
    '۲. شبکه Polygon Amoy (Chain ID: 80002) و توکن POL را انتخاب کن، اگر این گزینه‌ها ارائه می‌شوند.',
    '۳. برای شارژ کیف پول امانی N5، آدرس نمایش‌داده‌شده در پایین را در Faucet وارد کن.',
    '۴. درخواست را طبق شرایط Faucet ثبت کن و موجودی POL را در /wallet بررسی کن.', '',
    '🏦 آدرس کیف پول داخل ربات (امانی N5):', address, '',
    '⚠️ Faucet فقط POL تستیِ کارمزد شبکه می‌دهد، نه tNFIVE.',
    '↗️ برای برداشت tNFIVE به MetaMask، آدرس کیف پول شخصی خودت را در /withdraw وارد کن؛ آدرس N5 بالا مقصد برداشت نیست.',
    '⛽ N5 کارمزد برداشت از ربات را پوشش می‌دهد؛ استفاده از Faucet برای آن الزامی نیست.',
    '💡 برای ارسال تراکنش از MetaMask در آینده، POL تستی را به آدرس خود MetaMask دریافت کن.',
    '🔒 هرگز عبارت بازیابی یا Private Key را در Faucet وارد نکن.',
    '', AMOY_FAUCET_URL
  ].join('\n');
  return response([
    heading('〰️⛽ Polygon Amoy Faucet'),
    paragraph('۱. سایت رسمی Faucet را باز کن؛ Polygon Amoy / Chain ID: 80002 و POL را انتخاب کن.'),
    paragraph('۲. اگر می‌خواهی به کیف پول داخل ربات POL تستی بفرستی، این آدرس را کپی و در Faucet وارد کن:'),
    paragraph(address),
    paragraph('۳. درخواست POL را ثبت کن؛ دریافت به قوانین و موجودی Faucet بستگی دارد.'),
    divider(),
    paragraph('⚠️ Faucet توکن tNFIVE نمی‌دهد؛ فقط POL تستی برای Gas است.'),
    paragraph('↗️ برای برداشت tNFIVE به کیف پول شخصی، آدرس MetaMask خودت را در /withdraw بده، نه آدرس امانی بالا.'),
    paragraph('⛽ N5 کارمزد برداشت از ربات را پرداخت می‌کند؛ برای دریافت tNFIVE در MetaMask نیازی به Faucet نداری.'),
    paragraph('💡 برای ارسال تراکنش از MetaMask در آینده، Faucet را با آدرس همان MetaMask استفاده کن.'),
    paragraph('🔒 هرگز Seed Phrase یا Private Key را در Faucet وارد نکن.'),
  ], content, keyboard);
}
function withdrawalGuide() {
  return response([
    heading('〰️↗️ برداشت توکن تستی'),
    paragraph('برای انتقال tNFIVE به آدرس شخصی، این فرمان را در همین چت بفرست:'),
    paragraph(WITHDRAW_EXAMPLE),
    paragraph('روی «📋 کپی نمونه دستور برداشت» بزن، در چت Paste کن، سپس 0xYourPolygonAddress را با آدرس واقعی کیف پول شخصی خودت جایگزین کن.'),
    divider(),
    paragraph('✅ قبل از انتقال، مقصد و مقدار نمایش داده می‌شوند و باید دکمه تأیید را بزنی.'),
    paragraph('⛽ N5 کارمزد برداشت از ربات را تأمین می‌کند؛ برای دریافت در کیف پول شخصی POL لازم نیست.'),
    paragraph('🔗 برای ارسال تراکنش از کیف پول شخصی در آینده، می‌توانی با آدرس همان کیف پول از Polygon Faucet، POL تستی بگیری.'),
    paragraph('⚠️ Faucet توکن tNFIVE نمی‌دهد؛ فقط POL تستی برای Gas است.'),
    paragraph('🔒 محدودیت برداشت و فاصله زمانی برای محافظت از کیف پول اعمال می‌شود.'),
    paragraph('⚠️ فقط شبکه Polygon Amoy؛ هیچ توکن واقعی ارسال نمی‌شود.'),
  ], '〰️↗️ راهنمای برداشت\n\nنمونه قابل کپی:\n' + WITHDRAW_EXAMPLE +
    '\n\n📋 روی دکمه کپی بزن، Paste کن و 0xYourPolygonAddress را با آدرس واقعی MetaMask خودت عوض کن.' +
    '\n✅ تأیید برداشت با دکمه مجزا انجام می‌شود.' +
    '\n⛽ N5 گس برداشت را می‌دهد؛ برای دریافت، Faucet لازم نیست.' +
    '\n🔗 برای ارسال‌های بعدی از MetaMask، POL تستی از Faucet بگیر.' +
    '\n⚠️ Faucet توکن tNFIVE نمی‌دهد.\n🌐 فقط Polygon Amoy', withdrawCopyKeyboard());
}
export function parseWithdraw(text) {
  const parts = String(text ?? '').trim().split(/\s+/);
  if (parts.length !== 3 || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(parts[1]) ||
    !validAddress(parts[2])) return null;
  return { amount: parts[1], destination: parts[2] };
}
async function service(env, userId, path, method = 'GET', data) {
  if (!env.WALLET_SERVICE_KEY) throw new Error('WALLET_NOT_CONFIGURED');
  const endpoint = env.WALLET
    ? 'https://wallet.internal' + path
    : env.WALLET_API_URL?.startsWith('https://')
      ? env.WALLET_API_URL.replace(/\/$/, '') + path
      : null;
  if (!endpoint) throw new Error('WALLET_NOT_CONFIGURED');
  const opts = { method, signal: AbortSignal.timeout(path.endsWith('/ensure') ? 2500 : 12000), headers: {
    'x-wallet-service-key': env.WALLET_SERVICE_KEY,
    'x-telegram-user-id': String(userId),
  } };
  if (data) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(data);
  }
  const result = await (env.WALLET ? env.WALLET.fetch(endpoint, opts) : fetch(endpoint, opts));
  if (!result.ok) throw new Error('WALLET_API_ERROR_' + result.status);
  return result.json();
}
/** Best-effort, free and idempotent. Input comes from a verified Telegram update. */
export async function ensureTelegramWallet(env, user) {
  if (!Number.isSafeInteger(user?.id) || user.id <= 0 || user.is_bot) return null;
  return service(env, user.id, '/internal/wallet/ensure', 'POST', {
    displayName: safe(user.first_name || user.username || 'Player', 48),
  });
}
async function view(env, user, section) {
  if (section === 'm') return intro();
  if (section === 'x') return withdrawalGuide();
  // Rolling deploy: the existing Wallet Worker may not yet have /ensure.
  // Existing 20 addresses must stay accessible until the new route goes live.
  try { await ensureTelegramWallet(env, user); } catch { /* read old wallet below */ }
  if (section === 'w') return accountView(await service(env, user.id, '/internal/wallet'));
  if (section === 'f') return faucetGuide(await service(env, user.id, '/internal/wallet'));
  if (section === 'r' || section === 't') return historyView(await service(env, user.id, '/internal/history'), section);
  throw new Error('UNKNOWN_WALLET_SECTION');
}
async function dispatch(send, method, destination, doc) {
  const richPayload = { ...destination, ...doc.rich };
  try {
    await send(method, richPayload);
    return;
  } catch (error) {
    if (!isRichUnsupported(error)) throw error;
  }
  await send(method === 'sendRichMessage' ? 'sendMessage' : method, { ...destination, ...doc.fallback });
}
export async function walletCommand(message, command, env, send) {
  const chat = message.chat, user = message.from;
  if (!isPrivateOwner(chat, user)) {
    if (Number.isSafeInteger(chat?.id)) await send('sendMessage', {
      chat_id: chat.id,
      text: '〰️ کیف پول خصوصی است؛ در چت شخصی ربات بازش کن.',
      reply_markup: { inline_keyboard: [[{ text: '🔐 ورود به کیف پول', url: TG_WALLET_LINK }]] },
    });
    return;
  }
  const destination = { chat_id: chat.id };
  try {
    if (command === 'withdraw') {
      const form = parseWithdraw(message.text);
      if (!form) return dispatch(send, 'sendRichMessage', destination, withdrawalGuide());
      // Keep existing withdrawals usable during a staggered bot/Wallet deploy.
      try { await ensureTelegramWallet(env, user); } catch { /* use existing account */ }
      const withdrawal = await service(env, user.id, '/internal/withdrawals', 'POST', form);
      const address = validAddress(withdrawal.destination);
      if (!address || !/^[a-f0-9-]{36}$/i.test(withdrawal.requestId)) throw new Error('INVALID_WITHDRAWAL_RESPONSE');
      const confirm = response([
        heading('〰️↗️ تأیید برداشت'),
        table(['مورد', 'مقدار'], [['مقدار', safe(withdrawal.amount, 40) + ' tNFIVE'], ['شبکه', 'Polygon Amoy']]),
        paragraph('📬 مقصد: ' + address),
        divider(),
        paragraph('⚠️ آدرس را کامل بررسی کن. تأیید یعنی اجازه ارسال تراکنش تستی به همین آدرس.'),
        paragraph('⏳ این درخواست فقط ۱۵ دقیقه قابل تأیید است.'),
      ], '〰️↗️ تأیید برداشت\nمقدار: ' + safe(withdrawal.amount, 40) + ' tNFIVE\nمقصد: ' + address + '\nشبکه: Polygon Amoy\n⏳ ۱۵ دقیقه فرصت تأیید داری.',
      { inline_keyboard: [
        [{ text: '✅ تأیید برداشت', callback_data: 'wd:' + withdrawal.requestId }],
        [button('❎ بازگشت بدون تأیید', 'w')],
      ] });
      return dispatch(send, 'sendRichMessage', destination, confirm);
    }
    const section = ({ wallet: 'w', rewards: 'r', transactions: 't', wallethelp: 'm' })[command];
    return dispatch(send, 'sendRichMessage', destination, await view(env, user, section || 'm'));
  } catch {
    const adminHint = env.ADMIN_TELEGRAM_USER_ID && String(user.id) === String(env.ADMIN_TELEGRAM_USER_ID)
      ? '\n\n🛠 برای بررسی اتصال دو Worker: /walletcheck' : '';
    return send('sendMessage', { ...destination, text: ERROR_MESSAGE + adminHint, reply_markup: walletKeyboard() });
  }
}
export async function handleWalletNavigation(callback, env, send) {
  const finish = text => send('answerCallbackQuery', {
    callback_query_id: callback.id, ...(text ? { text, show_alert: false } : { cache_time: 0 }),
  });
  if (!isPrivateOwner(callback.message?.chat, callback.from)) return finish('برای دسترسی، چت شخصی خودت را باز کن.');
  const section = /^nw:([wrtxmf])$/.exec(callback.data || '')?.[1];
  if (!section) return finish('گزینه نامعتبر است.');
  const destination = { chat_id: callback.message.chat.id, message_id: callback.message.message_id };
  if (!Number.isSafeInteger(destination.message_id)) return finish('این پیام قدیمی است. /wallet را بفرست.');
  try {
    await dispatch(send, 'editMessageText', destination, await view(env, callback.from, section));
    return finish();
  } catch (error) {
    if (isNoChange(error)) return finish();
    return finish('فعلاً اطلاعات در دسترس نیست. دوباره /wallet را بفرست.');
  }
}
export async function confirmWalletCallback(callback, env, send) {
  const answer = text => send('answerCallbackQuery', {
    callback_query_id: callback.id, text, show_alert: false, cache_time: 0,
  });
  if (!isPrivateOwner(callback.message?.chat, callback.from)) return answer('درخواست نامعتبر است.');
  const match = /^wd:([a-f0-9-]{36})$/i.exec(callback.data || '');
  if (!match) return answer('درخواست نامعتبر است.');
  try {
    await service(env, callback.from.id, '/internal/withdrawals/' + match[1] + '/confirm', 'POST');
    await answer('درخواست برداشت در صف قرار گرفت.');
    return send('sendMessage', {
      chat_id: callback.from.id,
      text: '〰️✅ برداشت تأیید شد.\n⏳ وضعیت انتقال را در «تراکنش‌ها» پیگیری کن.',
      reply_markup: walletKeyboard(),
    });
  } catch {
    return answer('تأیید ممکن نشد؛ احتمالاً درخواست منقضی شده است.');
  }
}
