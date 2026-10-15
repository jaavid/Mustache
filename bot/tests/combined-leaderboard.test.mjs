import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { leaderboard } from '../src/sessions.js';

test('one verified best round per player across both modes, preserving badges', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec(`
      CREATE TABLE game_users (user_id INTEGER PRIMARY KEY, display_name TEXT NOT NULL);
      CREATE TABLE game_rounds (
        id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, score INTEGER,
        ranked_score INTEGER, golden_perfect INTEGER NOT NULL DEFAULT 0,
        mode TEXT NOT NULL, finished_at INTEGER NOT NULL
      );
      INSERT INTO game_users VALUES (1, 'Ada'), (2, 'Bor'), (3, 'Cam'), (4, 'Dee'), (5, 'NoScore');
      INSERT INTO game_rounds (id, user_id, score, golden_perfect, mode, finished_at) VALUES
        ('a-classic', 1, 800, 1, 'classic', 1),
        ('a-rush', 1, 1350, 0, 'goldRush', 2),
        ('b-classic', 2, 1350, 1, 'classic', 3),
        ('c-rush', 3, 1350, 0, 'goldRush', 4),
        ('d-classic', 4, 900, 0, 'classic', 5),
        ('d-failed', 4, NULL, 0, 'goldRush', 6);
    `);
    const db = {
      prepare(sql) {
        return {
          bind(...params) {
            return { async all() { return { results: sqlite.prepare(sql).all(...params) }; } };
          },
        };
      },
    };
    const now = Date.UTC(2026, 9, 14);
    const combined = await leaderboard(db, now, { period: 'all', userId: 4 });
    assert.equal(combined.mode, 'combined');
    assert.equal(combined.playerCount, 4);
    assert.deepEqual(combined.players.map(row => [row.rank, row.name, row.mode, row.score, row.goldenPerfect]), [
      [1, 'Bor', 'classic', 1350, 1],
      [2, 'Ada', 'goldRush', 1350, 0],
      [3, 'Cam', 'goldRush', 1350, 0],
      [4, 'Dee', 'classic', 900, 0],
    ]);
    assert.equal(combined.me.rank, 4);
    assert.equal(combined.rival.rank, 3);
    const classic = await leaderboard(db, now, { period: 'all', mode: 'classic' });
    assert.deepEqual(classic.players.map(row => row.name), ['Bor', 'Dee', 'Ada']);
    const goldRush = await leaderboard(db, now, { period: 'all', mode: 'goldRush' });
    assert.deepEqual(goldRush.players.map(row => row.name), ['Ada', 'Cam']);
    const missing = await leaderboard(db, now, { period: 'all', userId: 5 });
    assert.equal(missing.me, null);
    assert.equal(missing.playerCount, 4);
  } finally {
    sqlite.close();
  }
});
