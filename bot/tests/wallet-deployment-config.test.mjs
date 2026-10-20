import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Wallet service binding is declared in bot Wrangler, not a dashboard-only setting', () => {
  const config=file('../wrangler.toml');
  assert.match(config, /keep_vars\s*=\s*true/);
  assert.match(config, /\[\[services\]\]\s*binding\s*=\s*"WALLET"\s*service\s*=\s*"n5-wallet-service-amoy"/);
  assert.doesNotMatch(config, /^\s*WALLET_SERVICE_KEY\s*=/m);
  assert.doesNotMatch(config, /^\s*ADMIN_TELEGRAM_USER_ID\s*=/m);
});

test('Production bot deployment injects common Wallet secret and operator ID from GitHub only', () => {
  const workflow=file('../../.github/workflows/deploy-cloudflare-worker.yml');
  assert.match(workflow, /WALLET_SERVICE_KEY:\s*\$\{\{ secrets\.WALLET_SERVICE_KEY \}\}/);
  assert.match(workflow, /ADMIN_TELEGRAM_USER_ID:\s*\$\{\{ vars\.ADMIN_TELEGRAM_USER_ID \}\}/);
  assert.match(workflow, /secrets:\s*\|\s*BOT_TOKEN\s*WEBHOOK_SECRET\s*WALLET_SERVICE_KEY/);
  assert.match(workflow, /text\.replace\(section, section \+ 'ADMIN_TELEGRAM_USER_ID = "'/);
  assert.doesNotMatch(workflow, /WALLET_SERVICE_KEY:\s*['"]0x[a-fA-F0-9]{64}['"]/);
});
