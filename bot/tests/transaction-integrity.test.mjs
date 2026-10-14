import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { startRound, finishRound } from '../src/sessions.js';
import { periodBounds } from '../src/periods.js';

/** Run real SQLite constraints and transactions, not a non-transactional D1 mock.
 * D1 batch is documented to execute its prepared statements in one transaction.
 */
class TransactionalD1 {
  constructor() {
    this.connection = new DatabaseSync(':memory:');
    this.connection.exec('PRAGMA foreign_keys=ON');
    for (const migration of [
      '0001_game_scores.sql',
      '0002_tehran_scoreboards.sql',
      '0003_golden_perfect.sql',
      '0004_player_progression.sql',
      '0005_gameplay_metrics.sql',
    ]) {
      this.connection.exec(readFileSync(new URL('../migrations/' + migration, import.meta.url), 'utf8'));
    }
    this.failSql = null;
  }

  prepare(sql) {
    return {
      bind: (...args) => ({
        run: async () => {
          if (this.failSql && sql.startsWith(this.failSql)) {
            this.failSql = null;
            throw new Error('INJECTED_WRITE_FAILURE');
          }
          const result = this.connection.prepare(sql).run(...args);
          return { meta: { changes: result.changes } };
        },
        first: async () => this.connection.prepare(sql).get(...args) ?? null,
        all: async () => ({ results: this.connection.prepare(sql).all(...args) }),
      }),
    };
  }

  async batch(statements) {
    this.connection.exec('BEGIN IMMEDIATE');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.connection.exec('COMMIT');
      return results;
    } catch (error) {
      this.connection.exec('ROLLBACK');
      throw error;
    }
  }

  read(sql, ...args) {
    return this.connection.prepare(sql).get(...args) ?? null;
  }

  close() {
    this.connection.close();
  }
}

async function register(db, id, now) {
  await db.prepare('INSERT INTO game_users(user_id, display_name, updated_at) VALUES(?, ?, ?)')
    .bind(id, 'Player ' + id, now).run();
  const token = 'session-' + id;
  await db.prepare(
    'INSERT INTO game_sessions(token_hash, user_id, chat_id, message_id, expires_at) VALUES(?, ?, ?, ?, ?)'
  ).bind(token, id, id, id, now + 600000).run();
  return { token_hash: token, user_id: id };
}

async function buildCatchUpBoard(db, now) {
  // Make player 20 last among 20 valid weekly classic players.
  for (let id = 1; id <= 20; id++) {
    const session = await register(db, id, now);
    await db.prepare(
      'INSERT INTO game_rounds(id, token_hash, user_id, portrait, started_at, expires_at, ' +
      'finished_at, score, week_start) VALUES(?, ?, ?, 0, ?, ?, ?, ?, ?)'
    ).bind('historic-' + id, session.token_hash, id, now - 120000, now - 20000,
      now - 60000, (21 - id) * 100, periodBounds(now, 'week').start).run();
  }
  await db.prepare(
    'INSERT INTO game_progress(user_id, xp, rounds_played, active_days, last_active_day, updated_at) ' +
    'VALUES(20, 250, 5, 1, ?, ?)'
  ).bind(periodBounds(now, 'day').start, now).run();
  return { token_hash: 'session-20', user_id: 20 };
}

test('failed Gold Rush round INSERT rolls back daily Golden Ticket', async () => {
  const db = new TransactionalD1();
  try {
    const now = Date.UTC(2026, 9, 14, 8);
    const session = await buildCatchUpBoard(db, now);
    db.failSql = 'INSERT INTO game_rounds';
    await assert.rejects(startRound(db, session, false, now, 'goldRush'), /INJECTED_WRITE_FAILURE/);
    assert.equal(db.read('SELECT COUNT(*) AS n FROM game_gold_tickets').n, 0);
    assert.equal(db.read("SELECT COUNT(*) AS n FROM game_rounds WHERE mode='goldRush'").n, 0);

    const started = await startRound(db, session, false, now, 'goldRush');
    assert.equal(started.mode, 'goldRush');
    assert.ok(db.read('SELECT id FROM game_rounds WHERE id=?', started.roundId));
    assert.equal(db.read('SELECT COUNT(*) AS n FROM game_gold_tickets').n, 1);
    await assert.rejects(startRound(db, session, false, now + 1000, 'goldRush'), /GOLD_RUSH_LOCKED|GOLD_TICKET_USED/);
    assert.equal(db.read("SELECT COUNT(*) AS n FROM game_rounds WHERE mode='goldRush'").n, 1);
  } finally {
    db.close();
  }
});

for (const failurePoint of ['INSERT INTO game_progress', 'UPDATE game_referrals SET qualified_at']) {
  test('finish rollback on ' + failurePoint + ', then one successful retry', async () => {
    const db = new TransactionalD1();
    try {
      const t0 = Date.UTC(2026, 9, 14, 8);
      await register(db, 7, t0);
      const player = await register(db, 27, t0);
      await db.prepare(
        'INSERT INTO game_referrals(referred_user_id, referrer_user_id, created_at) VALUES(?, ?, ?)'
      ).bind(27, 7, t0).run();
      const started = await startRound(db, player, false, t0, 'classic');
      const now = t0 + 45000;
      const data = {
        roundId: started.roundId, score: 100,
        shots: [{ tMs: 1000, aim: { x: 289, y: 280 }, lip: { x: 289, y: 280 },
          variant: 'normal', comboBefore: 0 }],
      };

      db.failSql = failurePoint;
      await assert.rejects(finishRound(db, player, data, now), /INJECTED_WRITE_FAILURE/);
      const afterError = db.read('SELECT score, ranked_score, progress_recorded FROM game_rounds WHERE id=?', started.roundId);
      assert.equal(afterError.score, null);
      assert.equal(afterError.ranked_score, null);
      assert.equal(afterError.progress_recorded, 0);
      assert.equal(db.read('SELECT COUNT(*) AS n FROM game_progress WHERE user_id=27').n, 0);
      assert.equal(db.read('SELECT qualified_at FROM game_referrals WHERE referred_user_id=27').qualified_at, null);
      assert.equal(db.read('SELECT COUNT(*) AS n FROM game_round_metrics').n, 0);

      const saved = await finishRound(db, player, data, now + 100);
      assert.equal(saved.score, 100);
      assert.equal(saved.duplicate, false);
      const progress = db.read('SELECT xp, rounds_played, active_days FROM game_progress WHERE user_id=27');
      assert.equal(progress.xp, 41);
      assert.equal(progress.rounds_played, 1);
      assert.equal(progress.active_days, 1);
      assert.equal(db.read('SELECT progress_recorded FROM game_rounds WHERE id=?', started.roundId).progress_recorded, 1);
      assert.equal(db.read('SELECT qualified_at FROM game_referrals WHERE referred_user_id=27').qualified_at, now + 100);
      assert.deepEqual(db.read('SELECT shots, perfect, good, misses, max_combo, golden_pickups FROM game_round_metrics WHERE round_id=?', started.roundId),
        { shots: 1, perfect: 1, good: 0, misses: 0, max_combo: 1, golden_pickups: 0 });

      const replay = await finishRound(db, player, { ...data, score: 9000, shots: [] }, now + 200);
      assert.equal(replay.score, 100);
      assert.equal(replay.duplicate, true);
      assert.equal(db.read('SELECT COUNT(*) AS n FROM game_round_metrics').n, 1);
      assert.equal(db.read('SELECT xp, rounds_played FROM game_progress WHERE user_id=27').xp, 41);
      assert.equal(db.read('SELECT xp, rounds_played FROM game_progress WHERE user_id=27').rounds_played, 1);
    } finally {
      db.close();
    }
  });
}

test('completed-round statements do not grant XP if the score UPDATE loses a race', async () => {
  const db = new TransactionalD1();
  try {
    const t0 = Date.UTC(2026, 9, 14, 8);
    const player = await register(db, 27, t0);
    const started = await startRound(db, player, false, t0);
    const { completedRoundStatements } = await import('../src/progression.js');
    const prepared = db.prepare(
      'UPDATE game_rounds SET score=100, finished_at=?, week_start=? ' +
      'WHERE id=? AND score IS NOT NULL'
    ).bind(t0 + 45000, periodBounds(t0, 'week').start, started.roundId);
    const [result] = await db.batch([
      prepared, ...completedRoundStatements(db, started.roundId, player.user_id, 100, t0 + 45000, true),
    ]);
    assert.equal(result.meta.changes, 0);
    assert.equal(db.read('SELECT COUNT(*) AS n FROM game_progress').n, 0);
    assert.equal(db.read('SELECT progress_recorded FROM game_rounds WHERE id=?', started.roundId).progress_recorded, 0);
  } finally {
    db.close();
  }
});
