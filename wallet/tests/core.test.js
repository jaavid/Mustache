import {test} from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { telegramId, tokenRaw, batchPlan, rankRewards, completedTehranWeek } from '../src/logic.js';
import { wrapKey, unwrapKey, tokenEqual } from '../src/security.js';
if(!globalThis.crypto) globalThis.crypto=webcrypto;

test('validation rejects decimal truncation and unsafe ids',()=>{
  assert.equal(tokenRaw('1.25',6),1250000n);
  assert.throws(()=>tokenRaw('1.0000001',6));
  assert.throws(()=>telegramId('Rowshanak'));
  assert.throws(()=>batchPlan([{telegramUserId:'1',amount:'2'},{telegramUserId:'1',amount:'3'}],18,'100'));
  assert.throws(()=>batchPlan([{telegramUserId:'1',amount:'101'}],18,'100'));
});
test('rank split is deterministic, fixed-budget and descends',()=>{
  const r=rankRewards(['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20'],'10000');
  assert.equal(r.length,20);
  assert.equal(r.reduce((v,x)=>v+BigInt(x.raw),0n),10000n);
  assert.ok(BigInt(r[0].raw)>BigInt(r[19].raw));
});
test('Iranian weekly boundary is Saturday midnight Tehran',()=>{
  const w=completedTehranWeek(Date.parse('2026-10-16T20:35:00Z'));
  assert.equal(new Date(w.end).toISOString(),'2026-10-16T20:30:00.000Z');
  assert.equal(w.end-w.start,604800000);
});
test('wallet key ciphertext bound to telegram identity',async()=>{
  const secret=Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64');
  const encrypted=await wrapKey('0x'+'11'.repeat(32),'11',secret);
  const row={key_cipher:encrypted.cipher,key_iv:encrypted.iv};
  assert.equal(await unwrapKey(row,'11',secret),'0x'+'11'.repeat(32));
  await assert.rejects(()=>unwrapKey(row,'22',secret));
  assert.ok(tokenEqual('Bearer x','Bearer x'));
  assert.ok(!tokenEqual('Bearer x','Bearer z'));
});

test('wallet Cloudflare deploy config is safe by default',async()=>{
  const {readFileSync}=await import('node:fs');
  const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(config.vars.CHAIN_ID,'80002');
  assert.equal(config.vars.TRANSFERS_ENABLED,'false');
  assert.equal(config.vars.AUTO_REWARDS_ENABLED,'false');
  assert.equal(config.vars.MANUAL_REWARDS_ONLY,'true');
});
