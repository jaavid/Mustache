import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const workerUrl = 'https://mustache.zedai.ir';
const db = {
  prepare(sql) {
    assert.match(sql, /COUNT\(\*\) AS rounds_started/);
    return { async first() { return { rounds_started: 11, rounds_scored: 0 }; } };
  },
};
const env = {
  DB: db,
  GAME_ORIGIN: 'https://mustache.alexa.ir',
  GAME_ORIGINS: 'https://jaavid.github.io',
};

test('score service status distinguishes started rounds from accepted scores', async () => {
  const response = await worker.fetch(new Request(workerUrl + '/api/status'), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: 'mustache-scores', database: 'connected', roundsStarted: 11, roundsScored: 0,
  });
});

test('approved first-party custom and GitHub Pages origins get CORS preflight', async () => {
  for (const origin of ['https://mustache.alexa.ir', 'https://jaavid.github.io']) {
    const response = await worker.fetch(new Request(workerUrl + '/api/round/start', {
      method: 'OPTIONS',
      headers: { origin, 'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type' },
    }), env);
    assert.equal(response.status, 204, origin);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.match(response.headers.get('access-control-allow-headers'), /Authorization/);
  }
});

test('unknown origins cannot perform browser score requests', async () => {
  const response = await worker.fetch(new Request(workerUrl + '/api/status', {
    headers: { origin: 'https://attacker.example' },
  }), env);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('API reports a meaningful authorization error, not misleading backend-offline', async () => {
  const response = await worker.fetch(new Request(workerUrl + '/api/round/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://mustache.alexa.ir' },
    body: JSON.stringify({ portrait: true }),
  }), env);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'UNAUTHORIZED' });
});
