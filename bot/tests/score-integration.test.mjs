import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { sha256 } from '../src/sessions.js';

const base = 'https://mustache.zedai.ir';
const now = () => Date.now();

class FakeD1 {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.rounds = new Map();
  }
  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async run() {
            if (sql.startsWith('INSERT INTO game_users')) {
              const [id, name] = args; db.users.set(id, name);
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('INSERT INTO game_sessions')) {
              const [token_hash, user_id, chat_id, message_id, inline_message_id, expires_at] = args;
              db.sessions.set(token_hash, { token_hash, user_id, chat_id, message_id, inline_message_id, expires_at });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('INSERT INTO game_rounds')) {
              const [id, token_hash, user_id, portrait, started_at, expires_at] = args;
              db.rounds.set(id, {
                id, token_hash, user_id, portrait, started_at, expires_at, score: null, week_start: null,
                telegram_synced: 0, telegram_state: 'pending',
              });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('UPDATE game_rounds SET score=')) {
              const [score, week_start, finished_at, id, token_hash, at] = args;
              const row = db.rounds.get(id);
              if (!row || row.token_hash !== token_hash || row.score !== null || row.expires_at < at) {
                return { meta: { changes: 0 } };
              }
              Object.assign(row, { score, week_start, finished_at });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('UPDATE game_rounds SET telegram_state=')) {
              const [telegram_state, telegram_synced, id, user_id] = args;
              const row = db.rounds.get(id);
              if (row && row.user_id === user_id) {
                Object.assign(row, { telegram_state, telegram_synced });
                return { meta: { changes: 1 } };
              }
            }
            return { meta: { changes: 0 } };
          },
          async first() {
            if (sql.startsWith('SELECT token_hash,')) {
              const [hash, at] = args;
              const row = db.sessions.get(hash);
              return row && row.expires_at > at ? row : null;
            }
            if (sql.startsWith('SELECT id, portrait, started_at,')) {
              const [id, hash, userId] = args;
              const row = db.rounds.get(id);
              return row?.token_hash === hash && row.user_id === userId ? row : null;
            }
            if (sql.startsWith('SELECT telegram_state')) {
              const [id, userId] = args;
              const row = db.rounds.get(id);
              return row?.user_id === userId ? row : null;
            }
            if (sql.startsWith('SELECT score, week_start')) return db.rounds.get(args[0]) || null;
            return null;
          },
          async all() {
            const hasWindow = sql.includes('finished_at >= ?');
            const [start, end, viewer] = hasWindow ? args : [null, null, args[0]];
            const best = new Map();
            for (const r of db.rounds.values()) {
              if (r.score === null || r.finished_at === undefined) continue;
              if (hasWindow && (r.finished_at < start || r.finished_at >= end)) continue;
              best.set(r.user_id, Math.max(r.score, best.get(r.user_id) || 0));
            }
            const items = [...best].map(([user_id, score]) => ({
              user_id, score, display_name: db.users.get(user_id),
            })).sort((a, b) => b.score - a.score || a.user_id - b.user_id);
            const ranked = items.map((r, i) => ({ ...r, rank: i + 1, player_count: items.length }));
            return { results: ranked.filter(r => r.rank <= 10 || r.user_id === viewer) };
          },
        };
      },
    };
  }
  async batch(queries) {
    return Promise.all(queries.map(q => q.run()));
  }
}

async function playOneRound(scoreResponse = { ok: true, result: { message_id: 44 } }) {
  const db = new FakeD1();
  const env = {
    DB: db,
    GAME_ORIGIN: 'https://mustache.alexa.ir',
    GAME_SHORT_NAME: 'mustache',
    GAME_URL: 'https://mustache.alexa.ir/',
    BOT_USERNAME: 'rjttobot',
    BOT_TOKEN: 'TEST_BOT_TOKEN',
    WEBHOOK_SECRET: 'TEST_WEBHOOK_SECRET',
  };
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const method = String(url).split('/').at(-1);
    const payload = JSON.parse(init.body);
    calls.push({ method, payload });
    if (method === 'setGameScore') return new Response(JSON.stringify(scoreResponse), { status: scoreResponse.ok ? 200 : 400 });
    if (method === 'getGameHighScores') return Response.json({
      ok: true, result: [{ position: 1, user: { id: 27, first_name: 'Ramin' }, score: 100 }],
    });
    return Response.json({ ok: true, result: true });
  };
  try {
    const callbackResponse = await worker.fetch(new Request(base + '/telegram/webhook', {
      method: 'POST',
      headers: { 'X-Telegram-Bot-Api-Secret-Token': 'TEST_WEBHOOK_SECRET' },
      body: JSON.stringify({
        callback_query: {
          id: 'callback1', game_short_name: 'mustache',
          from: { id: 27, first_name: 'Ramin' },
          message: { message_id: 44, chat: { id: 55 } },
        },
      }),
    }), env);
    assert.equal(callbackResponse.status, 200);
    const gameUrl = calls.find(c => c.method === 'answerCallbackQuery').payload.url;
    const token = new URL(gameUrl).searchParams.get('tg_session');
    assert.equal(db.sessions.has(await sha256(token)), true);
    const headers = {
      'content-type': 'application/json',
      authorization: 'Bearer ' + token,
      origin: 'https://mustache.alexa.ir',
    };
    const start = await worker.fetch(new Request(base + '/api/round/start', {
      method: 'POST', headers, body: JSON.stringify({ portrait: false }),
    }), env);
    assert.equal(start.status, 200);
    const { roundId } = await start.json();
    db.rounds.get(roundId).started_at = now() - 45000;
    const payload = { roundId, score: 100, shots: [
      { tMs: 1000, aim: {x:289,y:280}, lip:{x:289,y:280}, variant:'normal', comboBefore:0 },
    ] };
    const response = await worker.fetch(new Request(base + '/api/round/finish', {
      method: 'POST', headers, body: JSON.stringify(payload),
    }), env);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.score, 100);
    assert.equal(body.leaderboard.players[0].score, 100);
    assert.equal(body.leaderboard.me.rank, 1);
    const telegram = calls.find(c => c.method === 'setGameScore');
    assert.equal(telegram.payload.user_id, 27);
    assert.equal(telegram.payload.chat_id, 55);
    assert.equal(telegram.payload.message_id, 44);
    assert.equal(telegram.payload.disable_edit_message, false);
    const duplicateResponse = await worker.fetch(new Request(base + '/api/round/finish', {
      method: 'POST', headers, body: JSON.stringify({ roundId, score: 9999, shots: [] }),
    }), env);
    assert.equal(duplicateResponse.status, 200);
    assert.equal(calls.filter(c => c.method === 'setGameScore').length, 1);
    const publicResponse = await worker.fetch(new Request(base + '/api/leaderboard?period=week'), env);
    assert.equal(publicResponse.status, 200);
    assert.equal((await publicResponse.json()).players.length, 1);
    return { body, db, calls, roundId };
  } finally {
    globalThis.fetch = original;
  }
}

test('complete Telegram game registers D1 score, edits native Game Card and returns chat scores', async () => {
  const { body, db, calls, roundId } = await playOneRound();
  assert.equal(body.telegramState, 'updated');
  assert.equal(body.telegramSynced, true);
  assert.equal(db.rounds.get(roundId).telegram_synced, 1);
  assert.equal(body.telegramScores[0].name, 'Ramin');
  assert.equal(calls.filter(c => c.method === 'getGameHighScores').length, 2);
});

test('previous higher Telegram record does not invalidate weekly D1 result', async () => {
  const { body, db, roundId } = await playOneRound({
    ok: false, description: "Bad Request: score is not greater than the user's current score",
  });
  assert.equal(body.telegramState, 'previous_best');
  assert.equal(body.telegramSynced, false);
  assert.equal(db.rounds.get(roundId).score, 100);
  assert.equal(db.rounds.get(roundId).telegram_state, 'previous_best');
});
