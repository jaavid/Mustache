import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {
  handleTelegramUpdate,
  isSameSecret,
  parseGameCommand,
} from '../src/index.js';

const config = {
  GAME_URL: 'https://mustache.alexa.ir/',
  GAME_SHORT_NAME: 'mustache',
  BOT_USERNAME: 'rjttobot',
};

async function dispatch(update) {
  const calls = [];
  const mockDb = {
    prepare() { return { bind() { return this; } }; },
    async batch() { return []; },
  };
  await handleTelegramUpdate(update, { ...config, DB: mockDb }, async (method, payload) => {
    calls.push({ method, payload });
  });
  return calls;
}

test('commands only target rjttobot and ignore ordinary messages', () => {
  assert.equal(parseGameCommand('/play@rjttobot'), 'play');
  assert.equal(parseGameCommand('/start payload'), 'start');
  assert.equal(parseGameCommand('/play@another_bot'), null);
  assert.equal(parseGameCommand('hello'), null);
});

test('start and play send native Game Cards', async () => {
  const calls = await dispatch({ message: { text: '/play', chat: { id: 123 } } });
  assert.deepEqual(calls, [
    { method: 'sendGame', payload: { chat_id: 123, game_short_name: 'mustache' } },
  ]);
});

test('the Game Play callback opens the approved HTTPS game URL', async () => {
  const calls = await dispatch({
    callback_query: {
      id: 'cb-1', game_short_name: 'mustache',
      from: { id: 777, first_name: 'Ramin' },
      message: { message_id: 8, chat: { id: -99 } },
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'answerCallbackQuery');
  assert.equal(calls[0].payload.callback_query_id, 'cb-1');
  const result = new URL(calls[0].payload.url);
  assert.equal(result.origin, 'https://mustache.alexa.ir');
  assert.match(result.searchParams.get('tg_session'), /^[a-f0-9]{64}$/);
  assert.equal(calls[0].payload.cache_time, 0);
});

test('unknown games never get an open redirect', async () => {
  const calls = await dispatch({
    callback_query: { id: 'cb-2', game_short_name: 'other_game' },
  });
  assert.equal(calls[0].method, 'answerCallbackQuery');
  assert.equal(calls[0].payload.url, undefined);
});

test('inline mode responds with InlineQueryResultGame', async () => {
  const calls = await dispatch({ inline_query: { id: 'iq-1' } });
  assert.equal(calls[0].method, 'answerInlineQuery');
  assert.deepEqual(calls[0].payload.results, [
    { type: 'game', id: 'n5-mustache', game_short_name: 'mustache' },
  ]);
});

test('webhook requires the Telegram secret and never leaks token', async () => {
  const env = { ...config, BOT_TOKEN: 'PRIVATE_TOKEN', WEBHOOK_SECRET: 'webhook-secret' };
  const denied = await worker.fetch(new Request('https://test.invalid/telegram/webhook', {
    method: 'POST',
    body: JSON.stringify({ message: { text: '/play', chat: { id: 1 } } }),
  }), env);
  assert.equal(denied.status, 403);
  assert.ok(isSameSecret('webhook-secret', 'webhook-secret'));
  assert.equal(isSameSecret('not-correct', 'webhook-secret'), false);
  const health = await worker.fetch(new Request('https://test.invalid/health'), env);
  assert.equal(health.status, 200);
});

test('rejects unsafe game URLs before answering a callback', async () => {
  await assert.rejects(
    handleTelegramUpdate({ callback_query: { id: 'cb', game_short_name: 'mustache' } },
      { ...config, GAME_URL: 'http://unsafe.invalid/' },
      async () => { throw new Error('should not send'); }),
    /HTTPS/,
  );
});
