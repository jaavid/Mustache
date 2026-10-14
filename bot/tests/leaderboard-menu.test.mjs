import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTelegramUpdate, parseGameCommand } from '../src/index.js';
import { leaderboardKeyboard, formatLeaderboardMessage, parseLeaderboardCallback } from '../src/leaderboardMenu.js';
import { GAME_COMMANDS, mergeBotCommands, syncBotCommands } from '../src/commandSync.js';

const config = { GAME_URL: 'https://mustache.alexa.ir/', BOT_USERNAME: 'rjttobot' };
function mockDB() {
  const binds = [];
  return {
    binds,
    prepare(sql) {
      assert.match(sql, /ROW_NUMBER\(\) OVER/);
      return { bind(...args) {
        binds.push(args);
        return { async all() {
          const viewer = args.at(-1);
          const row = { user_id: 200, display_name: 'Ramin', score: 550, rank: 1, player_count: 11 };
          const own = { user_id: 999, display_name: 'You', score: 50, rank: 11, player_count: 11 };
          return { results: viewer === 999 ? [row, own] : [row] };
        } };
      } };
    },
  };
}
async function dispatch(update, db = mockDB()) {
  const calls = [];
  await handleTelegramUpdate(update, { ...config, DB: db }, async (method, payload) => calls.push({ method, payload }));
  return { calls, db };
}

test('all managed Telegram command descriptions carry the 〰️ moustache and fun copy', () => {
  assert.equal(GAME_COMMANDS.length, 7);
  const expected = new Set(['play', 'leaderboard', 'top', 'score', 'profile', 'invite', 'help']);
  for (const item of GAME_COMMANDS) {
    assert.ok(expected.has(item.command), item.command);
    assert.match(item.description, /〰️/);
    assert.ok(item.description.length >= 3 && item.description.length <= 256);
  }
});

test('new slash command, bot username matching and aliases', () => {
  assert.equal(parseGameCommand('/leaderboard@RJTtobot'), 'leaderboard');
  assert.equal(parseGameCommand('/leaderboard@elsewhere'), null);
  assert.equal(parseGameCommand('/top'), 'top');
  assert.equal(parseGameCommand('/score'), 'score');
});

test('slash commands show weekly top ten, own rank, all tabs and game URL', async () => {
  for (const command of ['/leaderboard', '/top', '/score']) {
    const { calls } = await dispatch({ message: { chat: { id: 43 }, from: { id: 999 }, text: command } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'sendMessage');
    const out = calls[0].payload;
    assert.equal(out.chat_id, 43);
    assert.match(out.text, /رتبه شما: 11/);
    const buttons = out.reply_markup.inline_keyboard.flat();
    for (const key of ['lb:d:0', 'lb:w:0', 'lb:m:0', 'lb:a:0']) {
      assert.ok(buttons.some(b => b.callback_data === key));
    }
    assert.ok(buttons.some(b => b.url === 'https://t.me/RJTtobot?game=mustache'));
  }
});

test('callback changes the same message instead of flooding the chat', async () => {
  const { calls, db } = await dispatch({
    callback_query: {
      id: 'cb1', data: 'lb:m:0', from: { id: 999 },
      message: { message_id: 4, chat: { id: -45 } },
    },
  });
  assert.deepEqual(calls.map(c => c.method), ['editMessageText', 'answerCallbackQuery']);
  assert.equal(calls[0].payload.chat_id, -45);
  assert.equal(calls[0].payload.message_id, 4);
  assert.match(calls[0].payload.text, /ماه شمسی/);
  assert.match(calls[0].payload.text, /رتبه شما: 11/);
  assert.equal(db.binds[0].length, 4);
});

test('week navigation and invalid callbacks are tightly bounded', async () => {
  const { calls } = await dispatch({
    callback_query: { id: 'cb2', data: 'lb:w:1', from: { id: 999 },
      message: { message_id: 2, chat: { id: 44 } } },
  });
  const buttons = calls[0].payload.reply_markup.inline_keyboard.flat().map(b => b.callback_data);
  assert.ok(buttons.includes('lb:w:2'));
  assert.ok(buttons.includes('lb:w:0'));
  assert.equal(parseLeaderboardCallback('lb:w:12').offset, 12);
  for (const value of ['lb:w:13', 'lb:w:-1', 'lb:a:1', 'lb:x:0', 'lb:w:1;DROP TABLE']) {
    assert.equal(parseLeaderboardCallback(value), null);
    const invalid = await dispatch({ callback_query: { id: 'bad', data: value } });
    assert.equal(invalid.calls.length, 1);
    assert.equal(invalid.calls[0].method, 'answerCallbackQuery');
    assert.equal(invalid.calls[0].payload.show_alert, true);
  }
  assert.ok(!leaderboardKeyboard('week', 12).inline_keyboard.flat().some(b => b.callback_data === 'lb:w:13'));
});

test('inline callbacks and stale messages are safe', async () => {
  const inline = await dispatch({ callback_query: {
    id: 'inline', data: 'lb:a:0', from: { id: 999 }, inline_message_id: 'inline-123',
  } });
  assert.equal(inline.calls[0].payload.inline_message_id, 'inline-123');
  const stale = await dispatch({ callback_query: { id: 'stale', data: 'lb:w:0', from: { id: 999 } } });
  assert.equal(stale.calls[0].method, 'answerCallbackQuery');
  assert.equal(stale.calls[0].payload.show_alert, true);
});

test('golden-perfect achievers show badge without HTML injection', () => {
  const view = formatLeaderboardMessage({
    period: 'week', offset: 0, startLabel: 'week', playerCount: 1,
    players: [{ rank: 1, name: 'Gold', score: 450, goldenPerfect: 1 }],
    me: { rank: 1, name: 'Gold', score: 450, goldenPerfect: 1 },
  });
  assert.match(view.text, /450 🥇/);
});

test('rendered leaderboard stays plain text, independent of player name formatting', () => {
  const result = formatLeaderboardMessage({
    period: 'all', offset: 0, startLabel: 'All time', playerCount: 1,
    players: [{ rank: 1, name: '<Ramin &', score: 100 }],
  });
  assert.match(result.text, /<Ramin &/);
  assert.equal(result.parse_mode, undefined);
});

test('command picker preserves unrelated commands and avoids redundant updates', async () => {
  const others = [{ command: 'contact', description: 'Support' }];
  const next = mergeBotCommands([...others, { command: 'top', description: 'Old top' }]);
  assert.deepEqual(next.slice(0, GAME_COMMANDS.length), GAME_COMMANDS);
  assert.deepEqual(next.at(-1), others[0]);
  assert.deepEqual(mergeBotCommands(next), next);
  const calls = [];
  const fetcher = async (url, init) => {
    const method = url.split('/').at(-1);
    calls.push({ method, body: JSON.parse(init.body) });
    return Response.json({ ok: true, result: method === 'getMyCommands' ? others : true });
  };
  assert.equal(await syncBotCommands('123456:test_secret', fetcher), true);
  assert.deepEqual(calls.map(c => c.method), ['getMyCommands', 'setMyCommands']);
  assert.deepEqual(calls[1].body.commands.at(-1), others[0]);
  await assert.rejects(syncBotCommands('invalid', fetcher), /INVALID_BOT_TOKEN/);
});
