import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMustache2Result } from '../src/mustache2.js';

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
