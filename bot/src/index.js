/** Telegram Games API webhook for @rjttobot.
 *
 * This Worker only creates native Game Cards and opens the static HTML5 game.
 * It NEVER accepts browser scores or calls setGameScore.
 */
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
  const match = /^\/(start|play|help)(?:@([a-zA-Z0-9_]+))?$/i.exec(first);
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
        text: 'N5 Mustache Mayhem: send /play to launch the official Telegram game. Scores are local practice only; no tokens or verified leaderboard yet.',
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
    await send('answerCallbackQuery', {
      callback_query_id: callback.id,
      url: gameUrl,
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
    throw new Error('Telegram Bot API failed for ' + method);
  }
  return body.result;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response('ok', { status: 200 });
    }
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
