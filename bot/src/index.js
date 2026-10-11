/** Official Telegram Games webhook plus session-authenticated D1 score APIs.
 * Client-provided gameplay telemetry is re-scored but NOT prize-grade anti-cheat.
 */
import { issueSession, authenticate, startRound, finishRound, leaderboard } from './sessions.js';
import { parseLeaderboardCallback, formatLeaderboardMessage } from './leaderboardMenu.js';
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
  const match = /^\/(start|play|help|top|score|leaderboard)(?:@([a-zA-Z0-9_]+))?$/i.exec(first);
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
export async function handleTelegramUpdate(update, env, send) {
  const { gameShortName, gameUrl, botUsername } = gameConfig(env);

  if (update.message?.chat?.id !== undefined) {
    const message = update.message;
    const command = parseGameCommand(message.text, botUsername);
    if (command === 'start' || command === 'play') {
      await send('sendGame', { chat_id: message.chat.id, game_short_name: gameShortName });
    } else if (command === 'help') {
      await send('sendMessage', {
        chat_id: message.chat.id,
        text: '🎮 /play برای شروع بازی\n🏆 /leaderboard برای جدول‌های امروز، هفته، ماه شمسی و کل دوران\n📊 /top و /score هم جدول تعاملی را باز می‌کنند.\n\nهفته مسابقه: شنبه تا شنبه به وقت تهران.\nفعلاً جایزه توکنی فعال نیست.',
      });
    } else if (command === 'top' || command === 'score' || command === 'leaderboard') {
      if (!env.DB) throw new Error('D1_NOT_CONFIGURED');
      const board = await leaderboard(env.DB, Date.now(), { userId: message.from?.id });
      await send('sendMessage', {
        chat_id: message.chat.id,
        ...formatLeaderboardMessage(board),
      });
    }
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
    const view = formatLeaderboardMessage(board);
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
      await send('editMessageText', { ...destination, ...view });
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

export async function callTelegram(token, method, payload) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
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
  const allowedOrigin = env.GAME_ORIGIN || HTTP_ORIGIN;
  // Browser requests must originate from the deployed game; bearer session still
  // authenticates the user and Origin is NOT considered an authentication factor.
  if (source && source !== allowedOrigin) return jsonReply({ error: 'ORIGIN_DENIED' }, 403);
  const cors = source === allowedOrigin ? source : null;
  const api = url.pathname;
  if (request.method === 'OPTIONS') {
    if (source !== allowedOrigin) return new Response(null, { status: 403 });
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
    if (api === '/api/leaderboard' && request.method === 'GET') {
      const period = url.searchParams.get('period') || 'week';
      const offset = Number(url.searchParams.get('offset') || 0);
      const session = request.headers.has('authorization') ? await authenticate(env.DB, request) : null;
      if (request.headers.has('authorization') && !session) {
        return jsonReply({ error: 'UNAUTHORIZED' }, 401, cors);
      }
      return jsonReply(await leaderboard(env.DB, Date.now(), {
        period, offset, userId: session?.user_id,
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
        return jsonReply(await startRound(env.DB, session, body.portrait), 200, cors);
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
    const safe = /^(INVALID_|UNKNOWN_ROUND|ROUND_ALREADY_PROCESSED|SCORE_MISMATCH|IMPOSSIBLE_SHOT_RATE)/.test(message);
    if (!safe) console.error('Score API failure:', message);
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
