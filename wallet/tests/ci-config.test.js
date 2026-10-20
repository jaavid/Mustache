import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path,import.meta.url),'utf8');

test('Wallet config keeps existing non-code Cloudflare variables while payout switches stay off',()=>{
  const config=JSON.parse(read('../wrangler.jsonc'));
  assert.equal(config.keep_vars,true);
  assert.equal(config.vars.TRANSFERS_ENABLED,'false');
  assert.equal(config.vars.AUTO_REWARDS_ENABLED,'false');
  assert.equal(config.name,'n5-wallet-service-amoy');
  assert.equal(config.vars.ADMIN_TELEGRAM_USER_ID,undefined);
  assert.equal(config.vars.WALLET_SERVICE_KEY,undefined);
});
test('Wallet deployment uses same repository-level secret and operator variable as bot',()=>{
  const workflow=read('../../.github/workflows/deploy-wallet.yml');
  assert.match(workflow,/WALLET_SERVICE_KEY:\s*\$\{\{ secrets\.WALLET_SERVICE_KEY \}\}/);
  assert.match(workflow,/ADMIN_TELEGRAM_USER_ID:\s*\$\{\{ vars\.ADMIN_TELEGRAM_USER_ID \}\}/);
  assert.match(workflow,/secrets:\s*\|\s*WALLET_SERVICE_KEY/);
  assert.match(workflow,/data\['vars'\]\['ADMIN_TELEGRAM_USER_ID'\]\s*=\s*operator_id/);
});
