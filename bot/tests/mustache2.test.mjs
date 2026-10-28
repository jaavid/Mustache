import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMustache2Result, finishMustache2Round } from '../src/mustache2.js';

const started = 1_000_000;
const round = { started_at: started, expires_at: started + 30 * 60_000, score: null };

test('accepts a bounded casual Mustache2 victory', () => {
  const result = validateMustache2Result(round,
    { score: 4200, caught: 3, shots: 6, elapsedSeconds: 120 }, started + 121_000);
  assert.equal(result.score, 4200);
});

test('rejects forged upper-bound scores and extra captures', () => {
  assert.throws(() => validateMustache2Result(round,
    { score: 9000, caught: 3, shots: 3, elapsedSeconds: 120 }, started + 121_000), /INVALID_RESULT/);
  assert.throws(() => validateMustache2Result(round,
    { score: 1000, caught: 4, shots: 5, elapsedSeconds: 180 }, started + 181_000), /INVALID_RESULT/);
});

test('rejects early loss, impossible playtime and expired rounds', () => {
  assert.throws(() => validateMustache2Result(round,
    { score: 1000, caught: 1, shots: 2, elapsedSeconds: 12 }, started + 181_000), /INVALID_SCORE/);
  assert.throws(() => validateMustache2Result(round,
    { score: 4200, caught: 3, shots: 6, elapsedSeconds: 140 }, started + 10_000), /INVALID_DURATION/);
  assert.throws(() => validateMustache2Result(round,
    { score: 4200, caught: 3, shots: 6, elapsedSeconds: 120 }, round.expires_at + 1), /INVALID_DURATION/);
});
test('rejects replay of already scored round and negative scores', () => {
  assert.throws(() => validateMustache2Result({ ...round, score: 1200 },
    { score: 1200, caught: 1, shots: 2, elapsedSeconds: 180 }, started + 181_000), /INVALID_ROUND/);
  assert.throws(() => validateMustache2Result(round,
    { score: -1, caught: 0, shots: 0, elapsedSeconds: 180 }, started + 181_000), /INVALID_RESULT/);
});

test('concurrent retry returns the persisted score when another submission wins', async () => {
  const roundId = 'e46a950e-4fd8-43ee-b1f7-2db7c78cc065';
  const session = { user_id: 42, token_hash: 'test-hash' };
  let reads = 0;
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          assert.ok(args.length);
          return {
            async first() {
              reads++;
              if (sql.startsWith('SELECT id, started_at')) {
                return { ...round, telegram_state: 'pending' };
              }
              if (sql.startsWith('SELECT score, telegram_state')) {
                return { score: 4200, telegram_state: 'updated' };
              }
              throw new Error('unexpected query ' + sql);
            },
            async run() {
              assert.match(sql, /^UPDATE mustache2_rounds/);
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
  const result = await finishMustache2Round(db, session,
    { roundId, score: 4200, caught: 3, shots: 6, elapsedSeconds: 120 }, started + 121_000);
  assert.deepEqual(result, { score: 4200, duplicate: true, telegramState: 'updated' });
  assert.equal(reads, 2);
});

test('concurrent retry still fails if no committed result exists', async () => {
  const session = { user_id: 42, token_hash: 'test-hash' };
  const db = {
    prepare(sql) {
      return { bind() { return {
        async first() {
          if (sql.startsWith('SELECT id, started_at')) return { ...round, telegram_state: 'pending' };
          return { score: null, telegram_state: 'pending' };
        },
        async run() { return { meta: { changes: 0 } }; },
      }; } };
    },
  };
  await assert.rejects(
    finishMustache2Round(db, session, {
      roundId: 'e46a950e-4fd8-43ee-b1f7-2db7c78cc065',
      score: 4200, caught: 3, shots: 6, elapsedSeconds: 120,
    }, started + 121_000),
    /ROUND_ALREADY_PROCESSED/,
  );
});
