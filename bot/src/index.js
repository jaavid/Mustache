/** Official Telegram Games webhook plus session-authenticated D1 score APIs.
 * Client-provided gameplay telemetry is re-scored but NOT prize-grade anti-cheat.
 */
import { issueSession, authenticate, startRound, finishRound, leaderboard } from './sessions.js';
import { parseLeaderboardCallback, formatLeaderboardMessage, formatRichLeaderboardMessage } from './leaderboardMenu.js';
import { registerReferral, playerProfile, goldCatchUpEligible } from './progression.js';
import { walletCommand, confirmWalletCallback } from './walletCommands.js';
export const DEFAULT_GAME_URL = 'https://mustache.alexa.ir/';
export const DEFAULT_GAME_SHORT_NAME = 'mustache';
export const DEFAULT_BOT_USERNAME = 'rjttobot';

export function isSameSecret(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || !expected) return false;
  const encoder = new TextEncoder();
  const left = encoder.encode(actual);
  const right = encoder.encode(expected);
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}

export function parseGameCommand(input, botUsername = DEFAULT_BOT_USERNAME) {
  const first = String(input ?? '').trim().split(/\s+/)[0];
  const match = /^\/(start|play|help|top|score|leaderboard|profile|invite|wallet|rewards|transactions|withdraw)(?:@([a-zA-Z0-9_]+))?$/i.exec(first);
  if (!match) return null;
  if (match[2] && match[2].toLowerCase() !== botUsername.toLowerCase()) return null;
  return match[1].toLowerCase();
}

function gameConfig(env) {
  const gameShortName = env.GAME_SHORT_NAME || DEFAULT_GAME_SHORT_NAME;
  const gameUrl = env.GAME_URL || DEFAULT_GAME_URL;
  const botUsername = env.BOT_USERNAME || DEFAULT_BOT_USERNAME;
  const url = new URL(gameUrl);
  if (url.protocol !== 'https:') throw new Error('GAME_URL must use HTTPS');
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(gameShortName)) throw new Error('Invalid GAME_SHORT_NAME');
  return { gameShortName, gameUrl: url.toString(), botUsername };
}

/** Isolated dispatch permits testing without Telegram credentials or network. */
/** Only fall back when Telegram explicitly rejects Rich Messages; never retry a network error. */
function isRichUnsupported(error) {
  return error instanceof Error && error.message === 'TELEGRAM_RICH_UNSUPPORTED';
}

async function sendLeaderboard(chatId, board, send) {
  try {
    await send('sendRichMessage', {
      chat_id: chatId, ...formatRichLeaderboardMessage(board),
    });
  } catch (error) {
    if (!isRichUnsupported(error)) throw error;
    await send('sendMessage', {
      chat_id: chatId, ...formatLeaderboardMessage(board),
    });
  }
}

async function editLeaderboard(destination, board, presentation, send) {
  if (presentation === 'text') {
    return send('editMessageText', {
      ...destination, ...formatLeaderboardMessage(board),
    });
  }
  try {
    await send('editMessageText', {
      ...destination, ...formatRichLeaderboardMessage(board),
    });
  } catch (error) {
    if (!isRichUnsupported(error)) throw error;
    await send('editMessageText', {
      ...destination, ...formatLeaderboardMessage(board),
    });
  }
}

export async function handleTelegramUpdate(update, env, send) {
  const { gameShortName, gameUrl, botUsername } = gameConfig(env);

  if (update.message?.chat?.id !== undefined) {
    const message = update.message;
    const command = parseGameCommand(message.text, botUsername);
    if (command === 'start' || command === 'play') {
      if (command === 'start' && env.DB && message.from) await registerReferral(env.DB, message.from, message.text);
      await send('sendGame', { chat_id: message.chat.id, game_short_name: gameShortName });
    } else if (command === 'profile' || command === 'invite') {
      if (!env.DB || !Number.isSafeInteger(message.from?.id)) return;
      await env.DB.prepare('INSERT INTO game_users(user_id, display_name, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name, updated_at=excluded.updated_at')
        .bind(message.from.id, String(message.from.first_name || 'Player').slice(0, 48), Date.now()).run();
      const profile = await playerProfile(env.DB, message.from.id, botUsername);
      const goldBoard = command === 'profile' && !profile.goldUnlocked
        ? await leaderboard(env.DB, Date.now(), { userId: message.from.id, mode: 'classic' })
        : null;
      const ticketAvailable = goldBoard ? goldCatchUpEligible(profile, goldBoard) : false;
      const goldStatus = profile.goldUnlocked
        ? 'همیشگی باز شده'
        : profile.ticketUsedToday
          ? 'بلیت امروز مصرف شده'
          : ticketAvailable
            ? 'بلیت طلایی امروز فعال (یک شروع)'
            : profile.roundsPlayed + '/12 راند · ' + profile.activeDays + '/2 روز فعال';
      const output = command === 'invite'
        ? '〰️ لینک دعوت شما:\n' + profile.inviteUrl + '\n\nهر دوست جدید پس از تکمیل اولین بازی معتبر ۵٪ بوست روزانه (حداکثر ۳ نفر و ۲۰۰ امتیاز در هر راند) فعال می‌کند.'
        : '〰️ پروفایل ' + profile.name + '\nLevel ' + profile.level + ' · XP ' + profile.xp +
          '\nراندها: ' + profile.roundsPlayed + ' · روزهای فعال: ' + profile.activeDays +
          '\nرکورد Classic: ' + profile.bestClassic + ' · Gold Rush: ' + profile.bestGoldRush +
          '\nGold Rush: ' + goldStatus + '\nدعوت‌های امروز: ' + profile.dailyInvites + '/3';
      await send('sendMessage', { chat_id: message.chat.id, text: output });
    } else if (['wallet','rewards','transactions','withdraw'].includes(command)) {
      await walletCommand(message,command,env,send);
    } else if (command === 'help') {
      await send('sendMessage', {
        chat_id: message.chat.id,
        text: '〰️ به جنگل سیبیل خوش اومدی! 🎩\n\n🎯 /play — بزن سیبیل رو بنشون سر جاش!\n👤 /profile — سطح و کارنامه سیبیلی\n〰️ /invite — دعوت دوستان و بوست روزانه\n🏆 /leaderboard — جدول مشترک Classic و Gold Rush\n👑 /top — ده نفر برتر جنگل\n📈 /score — ببین سیبیلات چند امتیاز آوردن\n💰 /wallet — موجودی توکن تستی\n🎁 /rewards — پاداش‌های من\n📜 /transactions — تاریخچه\n↗️ /withdraw — برداشت تستی\n🧭 /help — همین راهنمای سیبیلی\n\n🗓 رقابت هفتگی: شنبه تا شنبه به وقت تهران\n⚠️ جایزه توکنی هنوز فعال نیست.',
      });
    } else if (command === 'top' || command === 'score' || command === 'leaderboard') {
      if (!env.DB) throw new Error('D1_NOT_CONFIGURED');
      const board = await leaderboard(env.DB, Date.now(), { userId: message.from?.id });
      await sendLeaderboard(message.chat.id, board, send);
    }
    return;
  }

  if (update.callback_query?.id && update.callback_query.data?.startsWith('wd:')) {
    await confirmWalletCallback(update.callback_query,env,send);
    return;
  }

  if (update.callback_query?.id && update.callback_query.data?.startsWith('lb:')) {
    const callback = update.callback_query;
    const target = parseLeaderboardCallback(callback.data);
    if (!target) {
      await send('answerCallbackQuery', {
        callback_query_id: callback.id,
        text: 'گزینه رتبه‌بندی نامعتبر است. دوباره /leaderboard را بفرستید.',
        show_alert: true,
      });
      return;
    }
    if (!env.DB) throw new Error('D1_NOT_CONFIGURED');
    const board = await leaderboard(env.DB, Date.now(), {
      ...target,
      userId: callback.from?.id,
    });
    // Edit the same bot message instead of sending one message per button tap.
    const inlineId = callback.inline_message_id;
    const chatId = callback.message?.chat?.id;
    const messageId = callback.message?.message_id;
    if (!inlineId && (chatId === undefined || messageId === undefined)) {
      await send('answerCallbackQuery', {
        callback_query_id: callback.id, text: 'این پیام دیگر قابل ویرایش نیست.', show_alert: true,
      });
      return;
    }
    const destination = inlineId
      ? { inline_message_id: inlineId }
      : { chat_id: chatId, message_id: messageId };
    try {
      await editLeaderboard(destination, board, target.presentation, send);
      await send('answerCallbackQuery', { callback_query_id: callback.id, cache_time: 0 });
    } catch (error) {
      // Re-tapping the active tab is normal, not a failed webhook delivery.
      if (error instanceof Error && error.message === 'TELEGRAM_MESSAGE_NOT_MODIFIED') {
        await send('answerCallbackQuery', { callback_query_id: callback.id, cache_time: 0 });
        return;
      }
      await send('answerCallbackQuery', {
        callback_query_id: callback.id, text: 'به‌روزرسانی جدول ممکن نشد. دوباره تلاش کنید.',
        show_alert: true, cache_time: 0,
      });
    }
    return;
  }

  if (update.callback_query?.id && update.callback_query.game_short_name) {
    const callback = update.callback_query;
    if (callback.game_short_name !== gameShortName) {
      await send('answerCallbackQuery', {
        callback_query_id: callback.id,
        text: 'Unknown game.',
        show_alert: true,
      });
      return;
    }
    if (!env.DB) throw new Error('D1_NOT_CONFIGURED');
    const personalizedUrl = await issueSession(env.DB, callback, gameUrl);
    await send('answerCallbackQuery', {
      callback_query_id: callback.id,
      url: personalizedUrl,
      cache_time: 0,
    });
    return;
  }

  if (update.inline_query?.id) {
    await send('answerInlineQuery', {
      inline_query_id: update.inline_query.id,
      cache_time: 0,
      is_personal: true,
      results: [{ type: 'game', id: 'n5-mustache', game_short_name: gameShortName }],
    });
  }
}

export async function callTelegram(token, method, payload, fetcher = fetch) {
  const response = await fetcher('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok || body.ok !== true) {
    const description = String(body?.description || '');
    if (method === 'setGameScore' &&
        /BOT_SCORE_NOT_MODIFIED|score.*not (greater|modified)|not greater/i.test(description)) {
      throw new Error('TELEGRAM_SCORE_NOT_HIGHER');
    }
    if (method === 'editMessageText' && /message is not modified/i.test(description)) {
      throw new Error('TELEGRAM_MESSAGE_NOT_MODIFIED');
    }
    // Distinguish unsupported/invalid rich payloads from network failures and chat errors.
    // Do not include bot credentials or raw Telegram payloads in thrown errors.
    const richRequest = method === 'sendRichMessage' ||
      (method === 'editMessageText' && !!payload.rich_message);
    if (richRequest && (response.status === 404 ||
      (response.status === 400 &&
        /rich|unsupported|not supported|can't parse|can't find|not found|unknown method|blocks|table/i.test(description)))) {
      throw new Error('TELEGRAM_RICH_UNSUPPORTED');
    }
    throw new Error('Telegram Bot API failed for ' + method);
  }
  return body.result;
}

const HTTP_ORIGIN = 'https://mustache.alexa.ir';

function jsonReply(data, status = 200, origin = null) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', vary: 'Origin' };
  if (origin) headers['access-control-allow-origin'] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}

async function gameApi(request, env, url) {
  const source = request.headers.get('origin');
  // Custom game domain plus explicitly configured first-party Pages origin.
  // Never return wildcard CORS: Telegram-issued bearer sessions remain mandatory.
  const allowedOrigins = new Set([
    env.GAME_ORIGIN || HTTP_ORIGIN,
    ...(env.GAME_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean),
  ]);
  if (source && !allowedOrigins.has(source)) {
    console.warn('Score API origin rejected', { path: url.pathname, reason: 'ORIGIN_DENIED' });
    return jsonReply({ error: 'ORIGIN_DENIED' }, 403);
  }
  const cors = source && allowedOrigins.has(source) ? source : null;
  const api = url.pathname;
  if (request.method === 'OPTIONS') {
    if (!cors) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': cors,
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'Authorization, Content-Type',
        'access-control-max-age': '600',
        vary: 'Origin',
      },
    });
  }
  if (!env.DB) return jsonReply({ error: 'DATABASE_NOT_CONFIGURED' }, 503, cors);

  try {
    if (api === '/api/status' && request.method === 'GET') {
      // Aggregates only; never expose Telegram identities or session secrets.
      const counts = await env.DB.prepare(
        'SELECT COUNT(*) AS rounds_started, COUNT(score) AS rounds_scored FROM game_rounds'
      ).first();
      return jsonReply({
        service: 'mustache-scores', database: 'connected',
        roundsStarted: Number(counts?.rounds_started || 0),
        roundsScored: Number(counts?.rounds_scored || 0),
      }, 200, cors);
    }
    if (api === '/api/profile' && request.method === 'GET') {
      const session = await authenticate(env.DB, request);
      if (!session) return jsonReply({ error: 'UNAUTHORIZED' }, 401, cors);
      const now = Date.now();
      const result = await playerProfile(env.DB, session.user_id, env.BOT_USERNAME || DEFAULT_BOT_USERNAME, now);
      const [board, classicBoard] = await Promise.all([
        leaderboard(env.DB, now, { userId: session.user_id }),
        leaderboard(env.DB, now, { userId: session.user_id, mode: 'classic' }),
      ]);
      const ticketEligible = goldCatchUpEligible(result, classicBoard);
      return jsonReply({ ...result, rank: board.me?.rank ?? null, weeklyScore: board.me?.score ?? 0, rival: board.rival ?? null,
        goldTicketEligible: ticketEligible,
        goldRushAvailable: result.goldUnlocked || ticketEligible }, 200, cors);
    }
    if (api === '/api/leaderboard' && request.method === 'GET') {
      const period = url.searchParams.get('period') || 'week';
      const offset = Number(url.searchParams.get('offset') || 0);
      const session = request.headers.has('authorization') ? await authenticate(env.DB, request) : null;
      if (request.headers.has('authorization') && !session) {
        return jsonReply({ error: 'UNAUTHORIZED' }, 401, cors);
      }
      return jsonReply(await leaderboard(env.DB, Date.now(), {
        period, offset, mode: url.searchParams.get('mode') || 'combined', userId: session?.user_id,
      }), 200, cors);
    }
    if ((api === '/api/round/start' || api === '/api/round/finish') && request.method === 'POST') {
      const session = await authenticate(env.DB, request);
      if (!session) return jsonReply({ error: 'UNAUTHORIZED' }, 401, cors);
      if (!request.headers.get('content-type')?.startsWith('application/json')) return jsonReply({ error: 'JSON_REQUIRED' }, 415, cors);
      const raw = await request.text();
      if (raw.length > 32768) return jsonReply({ error: 'TOO_LARGE' }, 413, cors);
      const body = JSON.parse(raw);
      if (api === '/api/round/start') {
        return jsonReply(await startRound(env.DB, session, body.portrait, Date.now(), body.mode || 'classic'), 200, cors);
      }
      const result = await finishRound(env.DB, session, body);
      // Always preserve the accepted D1 score. Telegram's Game Card scoreboard
      // uses a per-chat/all-time personal high, not our Tehran weekly rankings.
      const stored = await env.DB.prepare(
        'SELECT telegram_state FROM game_rounds WHERE id=? AND user_id=?'
      ).bind(body.roundId, session.user_id).first();
      let telegramState = stored?.telegram_state || 'pending';
      const gameContext = { user_id: session.user_id };
      if (session.inline_message_id) gameContext.inline_message_id = session.inline_message_id;
      else {
        gameContext.chat_id = session.chat_id;
        gameContext.message_id = session.message_id;
      }
      if (result.score > 0 && !['updated', 'previous_best'].includes(telegramState)) {
        try {
          // Telegram updates the native Game Card text when this succeeds.
          await callTelegram(env.BOT_TOKEN, 'setGameScore', {
            ...gameContext, score: result.score, disable_edit_message: false,
          });
          telegramState = 'updated';
        } catch (error) {
          telegramState = error instanceof Error && error.message === 'TELEGRAM_SCORE_NOT_HIGHER'
            ? 'previous_best' : 'retry';
        }
        await env.DB.prepare(
          'UPDATE game_rounds SET telegram_state=?, telegram_synced=? WHERE id=? AND user_id=?'
        ).bind(telegramState, telegramState === 'updated' ? 1 : 0, body.roundId, session.user_id).run();
      }
      let telegramScores = [];
      if (['updated', 'previous_best'].includes(telegramState)) {
        try {
          const highs = await callTelegram(env.BOT_TOKEN, 'getGameHighScores', gameContext);
          telegramScores = highs.map(row => ({
            rank: row.position,
            name: [row.user?.first_name, row.user?.last_name].filter(Boolean).join(' ').slice(0, 48) || 'Player',
            score: row.score,
          }));
        } catch {
          // Telegram's neighbor-based ranking is supplementary, not D1 authority.
        }
      }
      return jsonReply({
        ...result, telegramSynced: telegramState === 'updated',
        telegramState, telegramScores,
        leaderboard: await leaderboard(env.DB, Date.now(), { userId: session.user_id }),
      }, 200, cors);
    }
    return jsonReply({ error: 'NOT_FOUND' }, 404, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SERVER_ERROR';
    const safe = /^(INVALID_|UNKNOWN_ROUND|ROUND_ALREADY_PROCESSED|SCORE_MISMATCH|IMPOSSIBLE_SHOT_RATE|GOLD_)/.test(message);
    // Include only the short error code and route; no player data, scores or tokens.
    if (safe) console.warn('Score API validation rejected', { route: api, code: message });
    else console.error('Score API internal failure', { route: api, code: 'SERVER_ERROR' });
    return jsonReply({ error: safe ? message : 'SERVER_ERROR' }, safe ? 400 : 500, cors);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response('ok', { status: 200 });
    }
    if (url.pathname.startsWith('/api/')) return gameApi(request, env, url);
    if (url.pathname !== '/telegram/webhook') return new Response('Not found', { status: 404 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (
      !env.BOT_TOKEN ||
      !isSameSecret(
        request.headers.get('x-telegram-bot-api-secret-token'),
        env.WEBHOOK_SECRET,
      )
    ) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const raw = await request.text();
      if (raw.length > 131072) return new Response('Payload too large', { status: 413 });
      const update = JSON.parse(raw);
      await handleTelegramUpdate(update, env, (method, payload) =>
        callTelegram(env.BOT_TOKEN, method, payload),
      );
      return new Response('ok', { status: 200 });
    } catch (error) {
      // No tokens, webhook secrets or user payloads in logs.
      console.error('Telegram game webhook processing failed:', error instanceof Error ? error.message : 'unknown');
      return new Response('Upstream failure', { status: 502 });
    }
  },
};
