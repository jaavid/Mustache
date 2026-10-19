import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTelegramUpdate, parseGameCommand, callTelegram } from '../src/index.js';
import { leaderboardKeyboard, formatLeaderboardMessage, formatRichLeaderboardMessage, parseLeaderboardCallback } from '../src/leaderboardMenu.js';
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
async function dispatch(update, db = mockDB(), sender = async () => {}) {
  const calls = [];
  await handleTelegramUpdate(update, { ...config, DB: db }, async (method, payload) => {
    calls.push({ method, payload });
    await sender(method, payload);
  });
  return { calls, db };
}

test('all managed Telegram command descriptions carry the 〰️ moustache and fun copy', () => {
  assert.equal(GAME_COMMANDS.length, 11);
  const expected = new Set(['play', 'leaderboard', 'top', 'score', 'profile', 'invite', 'help', 'wallet', 'rewards', 'transactions', 'withdraw']);
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
    assert.equal(calls[0].method, 'sendRichMessage');
    const out = calls[0].payload;
    assert.equal(out.chat_id, 43);
    assert.equal(out.rich_message.is_rtl, true);
    assert.equal(out.rich_message.blocks.find(b => b.type === 'table').is_compact, true);
    assert.match(out.rich_message.blocks.at(-3).text, /رتبه شما: 11/);
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
  assert.equal(calls[0].payload.text, undefined);
  assert.ok(calls[0].payload.rich_message.blocks.some(b => b.text?.includes('ماه شمسی')));
  assert.ok(calls[0].payload.rich_message.blocks.some(b => b.text?.includes('رتبه شما: 11')));
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
  assert.equal(parseLeaderboardCallback('lb:w:0').mode, 'combined');
  assert.deepEqual(parseLeaderboardCallback('lb:g:w:1'), { period: 'week', offset: 1, mode: 'combined' });
  assert.equal(parseLeaderboardCallback('lb:w:12').offset, 12);
  for (const value of ['lb:w:13', 'lb:w:-1', 'lb:a:1', 'lb:x:0', 'lb:w:1;DROP TABLE', 'lb:g:a:1', 'lb:x:w:0', 'lb:g:w:13']) {
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
  assert.match(view.text, /🥇 Gold — 450 🎮 〰️✨/);
  assert.match(view.text, /🎮 کلاسیک · 🪙 گلدراش/);
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

test('legacy mode callbacks open unified standings without separate mode tabs', async () => {
  const { calls } = await dispatch({ callback_query: {
    id: 'gold', data: 'lb:g:w:2', from: { id: 999 },
    message: { message_id: 8, chat: { id: 44 } },
  } });
  assert.equal(calls[0].method, 'editMessageText');
  assert.ok(calls[0].payload.rich_message.blocks.some(b => b.text?.includes('Classic + 🪙 Gold Rush')));
  const buttons = calls[0].payload.reply_markup.inline_keyboard.flat();
  assert.ok(buttons.some(item => item.callback_data === 'lb:w:3'));
  assert.ok(buttons.some(item => item.callback_data === 'lb:d:0'));
  assert.ok(buttons.every(item => !item.callback_data || !/lb:[cg]:/.test(item.callback_data)));
  assert.ok(buttons.every(item => !item.callback_data || item.callback_data.length <= 64));
});

test('unified board displays mode and golden badges independently of rank medals', () => {
  const board = {
    period: 'week', offset: 0, startLabel: 'week', playerCount: 4,
    players: [
      { rank: 1, name: 'GoldRush', score: 1600, mode: 'goldRush', goldenPerfect: 0 },
      { rank: 2, name: 'ClassicGold', score: 1500, mode: 'classic', goldenPerfect: 1 },
      { rank: 3, name: 'Classic', score: 1400, mode: 'classic', goldenPerfect: 0 },
      { rank: 4, name: 'Fourth', score: 1300, mode: 'goldRush', goldenPerfect: 0 },
    ],
    me: { rank: 4, name: 'Fourth', score: 1300, mode: 'goldRush' },
  };
  const view = formatLeaderboardMessage(board);
  assert.match(view.text, /🥇 GoldRush — 1,600 🪙/);
  assert.match(view.text, /🥈 ClassicGold — 1,500 🎮 〰️✨/);
  assert.match(view.text, /🥉 Classic — 1,400 🎮/);
  assert.match(view.text, /04\. Fourth — 1,300 🪙/);
  assert.doesNotMatch(view.text, /04\. Fourth[^\n]*🥇/);
  assert.match(view.text, /رتبه شما: 4 · 1,300 امتیاز · 🪙/);
});

test('rich leaderboard uses typed striped compact table with separate rank and gameplay badges', () => {
  const board = {
    period: 'week', offset: 0, startLabel: 'این هفته', playerCount: 4,
    players: [
      { rank: 1, name: 'A', score: 1600, mode: 'goldRush' },
      { rank: 2, name: 'B', score: 1500, mode: 'classic', goldenPerfect: 1 },
      { rank: 3, name: 'C', score: 1400, mode: 'classic' },
      { rank: 4, name: 'D', score: 1300, mode: 'goldRush' },
    ],
    me: { rank: 4, score: 1300, mode: 'goldRush' },
  };
  const view = formatRichLeaderboardMessage(board);
  assert.equal(view.rich_message.is_rtl, true);
  assert.equal(view.rich_message.skip_entity_detection, true);
  assert.deepEqual(Object.keys(view.rich_message).sort(), ['blocks', 'is_rtl', 'skip_entity_detection']);
  const table = view.rich_message.blocks.find(block => block.type === 'table');
  assert.equal(table.is_bordered, true);
  assert.equal(table.is_striped, true);
  assert.equal(table.is_compact, true);
  assert.equal(table.cells.length, 5);
  assert.ok(table.cells[0].every(cell => cell.is_header));
  assert.deepEqual(table.cells.slice(1).map(row => row.map(cell => cell.text)), [
    ['🥇', 'A', '1,600', '🪙'],
    ['🥈', 'B', '1,500', '🎮 〰️✨'],
    ['🥉', 'C', '1,400', '🎮'],
    ['04', 'D', '1,300', '🪙'],
  ]);
  assert.ok(view.reply_markup.inline_keyboard.flat().some(button => button.text === '📄 نمایش متنی'));
});

test('rich leaderboard is safe for malicious names, empty weeks and at most ten rows', () => {
  const board = { period: 'week', offset: 2, playerCount: 11, players: [
    { rank: 1, name: '<img src=x> @name' + String.fromCharCode(10) + 'Injected' + String.fromCharCode(0x202e), score: 55, mode: 'classic' },
    ...Array.from({ length: 10 }, (_, i) => ({ rank: i + 2, name: 'Player ' + i, score: 50 - i })),
  ] };
  const rich = formatRichLeaderboardMessage(board);
  const table = rich.rich_message.blocks.find(b => b.type === 'table');
  assert.equal(table.cells.length, 11);
  assert.equal(table.cells[1][1].text.includes(String.fromCharCode(10)), false);
  assert.equal(table.cells[1][1].text.includes(String.fromCharCode(0x202e)), false);
  assert.match(table.cells[1][1].text, /<img src=x>/);
  const empty = formatRichLeaderboardMessage({ period: 'week', offset: 1, playerCount: 0, players: [], me: null });
  assert.equal(empty.rich_message.blocks.some(b => b.type === 'table'), false);
  assert.ok(empty.rich_message.blocks.some(b => b.text?.includes('هنوز امتیازی')));
  assert.ok(empty.rich_message.blocks.some(b => b.text?.includes('هفته قبل')));
});

test('text-only presentation can be selected and navigated without retrying rich', async () => {
  assert.deepEqual(parseLeaderboardCallback('lb:t:w:2'), {
    period: 'week', offset: 2, mode: 'combined', presentation: 'text',
  });
  assert.deepEqual(parseLeaderboardCallback('lb:r:w:2'), {
    period: 'week', offset: 2, mode: 'combined',
  });
  const { calls } = await dispatch({ callback_query: {
    id: 'cb-text', data: 'lb:t:w:2', from: { id: 999 },
    message: { message_id: 8, chat: { id: 44 } },
  } });
  assert.deepEqual(calls.map(call => call.method), ['editMessageText', 'answerCallbackQuery']);
  assert.equal(calls[0].payload.rich_message, undefined);
  assert.match(calls[0].payload.text, /رتبه شما: 11/);
  const buttons = calls[0].payload.reply_markup.inline_keyboard.flat();
  assert.ok(buttons.some(b => b.callback_data === 'lb:t:w:3'));
  assert.ok(buttons.some(b => b.callback_data === 'lb:r:w:2'));
});

test('unsupported Telegram Rich Messages fall back to plaintext without extra messages', async () => {
  const failRich = (method, payload) => {
    if (method === 'sendRichMessage' || (method === 'editMessageText' && payload.rich_message)) {
      throw new Error('TELEGRAM_RICH_UNSUPPORTED');
    }
  };
  const message = await dispatch({ message: {
    chat: { id: 44 }, from: { id: 999 }, text: '/leaderboard',
  } }, mockDB(), failRich);
  assert.deepEqual(message.calls.map(call => call.method), ['sendRichMessage', 'sendMessage']);
  assert.match(message.calls[1].payload.text, /رتبه شما: 11/);
  const callbacks = await dispatch({ callback_query: {
    id: 'cb-plain', data: 'lb:w:0', from: { id: 999 },
    message: { message_id: 8, chat: { id: 44 } },
  } }, mockDB(), failRich);
  assert.deepEqual(callbacks.calls.map(call => call.method), [
    'editMessageText', 'editMessageText', 'answerCallbackQuery',
  ]);
  assert.equal(callbacks.calls[1].payload.rich_message, undefined);
  assert.match(callbacks.calls[1].payload.text, /رتبه شما: 11/);
});

test('other Telegram send failures are not swallowed or retried', async () => {
  await assert.rejects(dispatch({ message: {
    chat: { id: 44 }, from: { id: 999 }, text: '/top',
  } }, mockDB(), () => { throw new Error('NETWORK_DOWN'); }), /NETWORK_DOWN/);
});

test('Telegram API classifies only explicit rich rejection and preserves not-modified handling', async () => {
  const mock = (status, description) => async () =>
    Response.json({ ok: false, description }, { status });
  await assert.rejects(
    callTelegram('123:fake', 'sendRichMessage', { rich_message: {} },
      mock(400, 'Bad Request: unsupported rich message blocks')),
    /TELEGRAM_RICH_UNSUPPORTED/,
  );
  await assert.rejects(
    callTelegram('123:fake', 'editMessageText', { rich_message: {} },
      mock(404, 'Not Found')),
    /TELEGRAM_RICH_UNSUPPORTED/,
  );
  await assert.rejects(
    callTelegram('123:fake', 'editMessageText', { rich_message: {} },
      mock(400, 'Bad Request: message is not modified')),
    /TELEGRAM_MESSAGE_NOT_MODIFIED/,
  );
  await assert.rejects(
    callTelegram('123:fake', 'sendRichMessage', { rich_message: {} },
      mock(403, 'Forbidden: bot was blocked by the user')),
    /Telegram Bot API failed/,
  );
});
