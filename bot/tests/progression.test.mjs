import test from 'node:test';
import assert from 'node:assert/strict';
import { referralIdFromStart, referralBonus, goldCatchUpEligible } from '../src/progression.js';
import { verifyRoundShots } from '../src/scoring.js';

test('accepts exact Telegram referral payload and rejects malformed ids', () => {
  assert.equal(referralIdFromStart('/start ref_1z'), 71);
  assert.equal(referralIdFromStart('/start@RJTtobot ref_2a'), 82);
  assert.equal(referralIdFromStart('/start something'), null);
  assert.equal(referralIdFromStart('/start ref_-1'), null);
  assert.equal(referralIdFromStart('/start ref_zzzzzzzzzzzz'), null);
});

test('referral multiplier is bounded by 3 friends and a per-round 200-point cap', () => {
  assert.equal(referralBonus(1400, 0), 0);
  assert.equal(referralBonus(1400, 1), 70);
  assert.equal(referralBonus(1400, 2), 140);
  assert.equal(referralBonus(1400, 3), 200);
  assert.equal(referralBonus(1400, 99), 200);
  assert.equal(referralBonus(1000, -10), 0);
});

test('catch-up golden ticket requires five rounds and bottom 30% of at least 20 players', () => {
  const progress = { goldUnlocked: false, ticketUsedToday: false, roundsPlayed: 5 };
  assert.equal(goldCatchUpEligible(progress, { playerCount: 20, me: { rank: 15 } }), true);
  assert.equal(goldCatchUpEligible(progress, { playerCount: 20, me: { rank: 14 } }), false);
  assert.equal(goldCatchUpEligible(progress, { playerCount: 19, me: { rank: 19 } }), false);
  assert.equal(goldCatchUpEligible({ ...progress, ticketUsedToday: true }, { playerCount: 20, me: { rank: 20 } }), false);
  assert.equal(goldCatchUpEligible({ ...progress, goldUnlocked: true }, { playerCount: 20, me: { rank: 20 } }), false);
});

test('server recomputes gold rush bonuses without collectibles or gold shot claims', () => {
  const shots = [1000, 1500, 2200, 2800].map((tMs, index) => ({
    tMs, aim: { x: 280, y: 280 }, lip: { x: 280, y: 280 },
    variant: 'normal', comboBefore: index,
  }));
  // 150 + 160 + (120 + 50 + 150) + 180 = 810.
  assert.equal(verifyRoundShots(shots, false, 810, [], 'goldRush').score, 810);
  assert.throws(() => verifyRoundShots(shots, false, 809, [], 'goldRush'), /SCORE_MISMATCH/);
  assert.throws(() => verifyRoundShots(shots, false, 810, [{ index: 0 }], 'goldRush'), /INVALID_GOLDEN_PICKUPS/);
  assert.throws(() => verifyRoundShots([{ ...shots[0], goldenShot: true }], false, 150, [], 'goldRush'), /INVALID_GOLDEN_SHOT/);
});

test('only daily and weekly boards use boosted score when ranking', async () => {
  const { leaderboard } = await import('../src/sessions.js');
  const statements = [];
  const db = { prepare(sql) { statements.push(sql); return { bind() {
    return { async all() { return { results: [] }; } };
  } }; } };
  const at = Date.UTC(2026, 9, 14);
  await leaderboard(db, at, { period: 'day' });
  await leaderboard(db, at, { period: 'week' });
  await leaderboard(db, at, { period: 'month' });
  await leaderboard(db, at, { period: 'all' });
  assert.match(statements[0], /SELECT user_id, COALESCE\(ranked_score, score\) AS score/);
  assert.match(statements[1], /SELECT user_id, COALESCE\(ranked_score, score\) AS score/);
  assert.match(statements[2], /SELECT user_id, score AS score/);
  assert.match(statements[3], /SELECT user_id, score AS score/);
  assert.match(statements[0], /mode IN \\('classic', 'goldRush'\\)/);
  await leaderboard(db, at, { period: 'week', mode: 'classic' });
  await leaderboard(db, at, { period: 'week', mode: 'goldRush' });
  assert.match(statements[4], /AND mode='classic'/);
  assert.match(statements[5], /AND mode='goldRush'/);
});
