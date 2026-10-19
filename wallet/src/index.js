import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { getAddress, formatUnits } from 'viem';
import { telegramId, tokenRaw, batchPlan, rankRewards, safeBatchId, completedTehranWeek } from './logic.js';
import { wrapKey, tokenEqual, sha256 } from './security.js';
import { context, balance, distributor, processNext } from './chain.js';

const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const MAX_BODY=32000;
async function payload(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('JSON_REQUIRED');
  const raw=await request.text();
  if(raw.length>MAX_BODY) throw new Error('BODY_TOO_LARGE');
  return JSON.parse(raw);
}
function isAdmin(req,env) { return Boolean(env.ADMIN_API_TOKEN) && tokenEqual(req.headers.get('authorization'), 'Bearer '+env.ADMIN_API_TOKEN); }
function isBot(req,env) { return Boolean(env.WALLET_SERVICE_KEY) && tokenEqual(req.headers.get('x-wallet-service-key'), env.WALLET_SERVICE_KEY); }
async function walletFor(db,id) {return db.prepare('SELECT telegram_user_id,display_name,address FROM wallets WHERE telegram_user_id=?').bind(telegramId(id)).first();}
async function bootstrap(env,body) {
  if(!env.WALLET_ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY_MISSING');
  const players=body?.players;
  if(!Array.isArray(players)||players.length<1||players.length>100) throw new Error('INVALID_PLAYERS');
  const unique=new Set(players.map(p=>telegramId(p?.telegramUserId)));
  if(unique.size!==players.length) throw new Error('DUPLICATE_PLAYER');
  const output=[];
  for (const item of players) {
    const id=telegramId(item.telegramUserId);
    let row=await walletFor(env.DB,id);
    if (!row) {
      const key=generatePrivateKey();
      const address=privateKeyToAccount(key).address;
      const encrypted=await wrapKey(key,id,env.WALLET_ENCRYPTION_KEY);
      await env.DB.prepare('INSERT OR IGNORE INTO wallets(telegram_user_id,display_name,address,key_cipher,key_iv,created_at) VALUES(?,?,?,?,?,?)')
        .bind(id,String(item.displayName||'').slice(0,48),address,encrypted.cipher,encrypted.iv,Date.now()).run();
      row=await walletFor(env.DB,id);
    }
    if(!row) throw new Error('WALLET_PERSIST_FAILED');
    output.push({telegramUserId:id,address:row.address});
  }
  return {wallets:output,count:output.length};
}
async function plan(env,body,source='genesis') {
  const batchId=safeBatchId(body?.batchId);
  const {decimals,contract}=await context(env);
  const batch=batchPlan(body?.allocations,decimals,env.MAX_BATCH_TOKENS||'10000');
  // No partial batch insertion if any Telegram ID is unregistered.
  for(const line of batch.items) if(!await walletFor(env.DB,line.id)) throw new Error('WALLET_NOT_FOUND');
  const digest=await sha256(JSON.stringify({batchId,token:contract.toLowerCase(),decimals,items:batch.items}));
  const prior=await env.DB.prepare('SELECT digest FROM reward_batches WHERE batch_id=?').bind(batchId).first();
  if(prior) {
    if(prior.digest!==digest) throw new Error('BATCH_ID_CONFLICT');
    return {batchId,state:'ALREADY_PLANNED',count:batch.items.length,total:formatUnits(BigInt(batch.sum),decimals)};
  }
  const created=Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO reward_batches(batch_id,digest,source,state,total_raw,decimals,created_at) VALUES(?,?,?,\'PLANNED\',?,?,?)')
      .bind(batchId,digest,source,batch.sum,decimals,created),
    ...batch.items.map(i=>env.DB.prepare('INSERT INTO allocations(batch_id,telegram_user_id,amount_raw,operation_key) VALUES(?,?,?,?)')
      .bind(batchId,i.id,i.raw,'reward:'+batchId+':'+i.id))
  ]);
  return {batchId,state:'PLANNED',count:batch.items.length,total:formatUnits(BigInt(batch.sum),decimals)};
}
async function genesisPlan(env) {
  if (!env.SCORES_DB) throw new Error('SCORES_DB_MISSING');
  const results=await env.SCORES_DB.prepare(`
    WITH best AS (
      SELECT user_id,score,golden_perfect,
        ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY score DESC,golden_perfect DESC,finished_at ASC,id ASC) AS own_rank
      FROM game_rounds WHERE score IS NOT NULL AND mode IN ('classic','goldRush')
    )
    SELECT CAST(b.user_id AS TEXT) AS telegram_user_id,u.display_name
    FROM best b JOIN game_users u ON u.user_id=b.user_id
    WHERE b.own_rank=1
    ORDER BY b.score DESC,b.golden_perfect DESC,b.user_id ASC
    LIMIT 20
  `).all();
  if (results.results.length!==20) throw new Error('GENESIS_REQUIRES_20_PLAYERS');
  const players=results.results.map(r=>({telegramUserId:telegramId(r.telegram_user_id),displayName:r.display_name}));
  // Bootstrap is idempotent, so rerunning this endpoint cannot replace keys.
  await bootstrap(env,{players});
  const {decimals}=await context(env);
  const lines=rankRewards(players.map(p=>p.telegramUserId),tokenRaw(env.WEEKLY_POOL_TOKENS||'10000',decimals));
  const out=await plan(env,{batchId:'genesis-0',allocations:lines.map(r=>({telegramUserId:r.id,amount:formatUnits(BigInt(r.raw),decimals)}))},'genesis');
  return {...out,players:players.map(p=>({telegramUserId:p.telegramUserId,displayName:p.displayName}))};
}
async function weeklyPlan(env,nowMs) {
  if(env.AUTO_REWARDS_ENABLED!=='true') return {state:'DISABLED'};
  if(!env.SCORES_DB) throw new Error('SCORES_DB_MISSING');
  const {start,end}=completedTehranWeek(nowMs);
  const batchId='weekly-'+start;
  const old=await env.DB.prepare('SELECT batch_id FROM reward_batches WHERE batch_id=?').bind(batchId).first();
  if(old) return {batchId,state:'ALREADY_PLANNED'};
  // One highest server-accepted Classic/Gold Rush round per player, never
  // SUM(score). Same tie-break as the live game: score, golden, user ID.
  const result=await env.SCORES_DB.prepare(`
    WITH best AS (
      SELECT user_id, COALESCE(ranked_score,score) AS ranked_points, golden_perfect,
        ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY COALESCE(ranked_score,score) DESC, golden_perfect DESC, finished_at ASC, id ASC) AS own_rank
      FROM game_rounds
      WHERE score IS NOT NULL AND finished_at>=? AND finished_at<?
        AND mode IN ('classic','goldRush')
    )
    SELECT CAST(user_id AS TEXT) AS telegram_user_id FROM best
    WHERE own_rank=1
    ORDER BY ranked_points DESC,golden_perfect DESC,user_id ASC LIMIT 100
  `).bind(start,end).all();
  const ids=result.results.map(r=>telegramId(r.telegram_user_id));
  if(!ids.length) return {batchId,state:'EMPTY'};
  // Fail closed if a new player has not been safely provisioned.
  for(const id of ids) if(!await walletFor(env.DB,id)) return {batchId,state:'MISSING_WALLETS'};
  const {decimals}=await context(env);
  const rewards=rankRewards(ids,tokenRaw(env.WEEKLY_POOL_TOKENS||'10000',decimals));
  return plan(env,{batchId,allocations:rewards.map(r=>({telegramUserId:r.id,amount:formatUnits(BigInt(r.raw),decimals)}))},'weekly');
}
async function summary(env,userId) {
  const wallet=await walletFor(env.DB,userId);
  if(!wallet) return {error:'WALLET_NOT_FOUND'};
  const current=await balance(env,wallet.address);
  return {telegramUserId:telegramId(userId),...current,network:'Polygon Amoy',explorer:'https://amoy.polygonscan.com/address/'+wallet.address};
}
async function history(env,userId) {
  const id=telegramId(userId);
  const rewards=await env.DB.prepare(`SELECT a.batch_id AS batchId,a.amount_raw AS amountRaw,b.decimals,b.source,t.tx_hash AS txHash,t.state
    FROM allocations a JOIN reward_batches b ON a.batch_id=b.batch_id
    LEFT JOIN tx_jobs t ON t.operation_key=a.operation_key
    WHERE a.telegram_user_id=? ORDER BY b.created_at DESC LIMIT 30`).bind(id).all();
  const withdrawals=await env.DB.prepare(`SELECT w.id,w.destination,w.amount_raw AS amountRaw,w.state,t.tx_hash AS txHash
    FROM withdrawals w LEFT JOIN tx_jobs t ON t.operation_key='withdraw:'||w.id||':token'
    WHERE w.telegram_user_id=? ORDER BY w.created_at DESC LIMIT 30`).bind(id).all();
  return {rewards:rewards.results,withdrawals:withdrawals.results};
}
async function requestWithdrawal(env,userId,body) {
  const id=telegramId(userId);
  const {decimals,contract,client}=await context(env);
  const wallet=await walletFor(env.DB,id);
  if(!wallet) throw new Error('WALLET_NOT_FOUND');
  const dest=getAddress(body.destination);
  if(dest.toLowerCase()===wallet.address.toLowerCase() || /^0x0{40}$/i.test(dest) || dest.toLowerCase()===contract.toLowerCase()) throw new Error('INVALID_DESTINATION');
  const amount=tokenRaw(body.amount,decimals);
  if(amount>tokenRaw(env.MAX_WITHDRAWAL_TOKENS||'1000',decimals)) throw new Error('WITHDRAWAL_LIMIT');
  const current=await client.readContract({address:contract,abi:(await import('./chain.js')).tokenAbi,functionName:'balanceOf',args:[getAddress(wallet.address)]});
  if(current<amount) throw new Error('INSUFFICIENT_NFIVE');
  // Expire unconfirmed button prompts after 15 minutes; cap sponsored gas
  // use by allowing at most one new withdrawal request every 24 hours.
  await env.DB.prepare("UPDATE withdrawals SET state='CANCELLED' WHERE telegram_user_id=? AND state='AWAITING_CONFIRMATION' AND created_at<?")
    .bind(id,Date.now()-15*60_000).run();
  const recent=await env.DB.prepare('SELECT id FROM withdrawals WHERE telegram_user_id=? AND created_at>? LIMIT 1')
    .bind(id,Date.now()-24*60*60_000).first();
  if(recent) throw new Error('WITHDRAWAL_COOLDOWN');
  // Only one active request per player. Confirmation is through the Telegram
  // callback_query.from identity, not a client-provided Telegram user ID.
  const active=await env.DB.prepare("SELECT id FROM withdrawals WHERE telegram_user_id=? AND state NOT IN ('COMPLETE','CANCELLED','REVIEW_REQUIRED') LIMIT 1").bind(id).first();
  if(active) throw new Error('WITHDRAWAL_ALREADY_ACTIVE');
  const requestId=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO withdrawals(id,telegram_user_id,destination,amount_raw,created_at) VALUES(?,?,?,?,?)')
    .bind(requestId,id,dest,amount.toString(),Date.now()).run();
  return {requestId,destination:dest,amount:body.amount,state:'AWAITING_CONFIRMATION'};
}
async function confirmWithdrawal(env,userId,requestId) {
  if(!/^[a-f0-9-]{36}$/i.test(requestId)) throw new Error('INVALID_WITHDRAWAL_ID');
  const id=telegramId(userId);
  const now=Date.now();
  const result=await env.DB.prepare("UPDATE withdrawals SET state='READY',confirmed_at=? WHERE id=? AND telegram_user_id=? AND state='AWAITING_CONFIRMATION' AND created_at>=?")
    .bind(now,requestId,id,now-15*60_000).run();
  if(result.meta.changes!==1) throw new Error('WITHDRAWAL_NOT_CONFIRMABLE');
  return {requestId,state:'READY'};
}
export class WalletSerial {
  constructor(state,env) {this.state=state;this.env=env;this.tail=Promise.resolve();}
  fetch(request) {
    const task=this.tail.then(async()=>{
      const url=new URL(request.url);
      if(url.pathname==='/run') return reply(await processNext(this.env));
      return reply({error:'NOT_FOUND'},404);
    });
    this.tail=task.catch(()=>{});
    return task.catch(()=>reply({error:'PROCESSING_ERROR'},503));
  }
}
async function serial(env) {
  return env.SERIAL.get(env.SERIAL.idFromName('global-transaction-serial')).fetch('https://internal/run',{method:'POST'});
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url),path=url.pathname,method=request.method;
    if(path==='/health'&&method==='GET') return reply({service:'n5-wallet-service',chainId:80002,transfersEnabled:env.TRANSFERS_ENABLED==='true',autoRewardsEnabled:env.AUTO_REWARDS_ENABLED==='true'});
    const admin=path.startsWith('/admin/'),internal=path.startsWith('/internal/');
    if(!(admin||internal)) return reply({error:'NOT_FOUND'},404);
    if(!(admin?isAdmin(request,env):isBot(request,env))) return reply({error:'UNAUTHORIZED'},401);
    try {
      if(admin) {
        if(path==='/admin/preflight'&&method==='GET') {
          const {client,contract,decimals,symbol}=await context(env);
          const address=getAddress(env.ADMIN_ADDRESS);
          const adminBalance=await balance(env,address);
          let operational=null;
          try {operational=await balance(env,distributor(env).address);} catch {operational={state:'NOT_CONFIGURED'};}
          return reply({contract,decimals,symbol,admin:adminBalance,distributor:operational,chainId:await client.getChainId()});
        }
        if(path==='/admin/bootstrap'&&method==='POST') return reply(await bootstrap(env,await payload(request)),201);
        if(path==='/admin/batches'&&method==='POST') return reply(await plan(env,await payload(request)),201);
        if(path==='/admin/genesis/prepare'&&method==='POST') return reply(await genesisPlan(env),201);
        if(path==='/admin/process'&&method==='POST') return serial(env);
        if(path==='/admin/weekly/plan'&&method==='POST') return reply(await weeklyPlan({...env,AUTO_REWARDS_ENABLED:'true'},Date.now()));
        if(path==='/admin/overview'&&method==='GET') {
          const counts=await env.DB.prepare('SELECT COUNT(*) as count FROM wallets').first();
          const batches=await env.DB.prepare('SELECT batch_id,state,total_raw,decimals,source FROM reward_batches ORDER BY created_at DESC LIMIT 20').all();
          return reply({wallets:counts.count,batches:batches.results});
        }
      }
      if(internal) {
        const id=telegramId(request.headers.get('x-telegram-user-id'));
        if(path==='/internal/wallet'&&method==='GET') return reply(await summary(env,id));
        if(path==='/internal/history'&&method==='GET') return reply(await history(env,id));
        if(path==='/internal/withdrawals'&&method==='POST') return reply(await requestWithdrawal(env,id,await payload(request)),201);
        const match=/^\/internal\/withdrawals\/([a-f0-9-]{36})\/confirm$/i.exec(path);
        if(match&&method==='POST') return reply(await confirmWithdrawal(env,id,match[1]));
      }
      return reply({error:'NOT_FOUND'},404);
    } catch(error) {
      const code=String(error?.message||'ERROR');
      const valid=/^(INVALID_|DUPLICATE_PLAYER|BATCH_OVER_BUDGET|BATCH_ID_CONFLICT|WALLET_NOT_FOUND|WITHDRAWAL_|INSUFFICIENT_NFIVE|BODY_TOO_LARGE|JSON_REQUIRED)/.test(code);
      return reply({error:valid?code:'OPERATION_FAILED'},valid?400:503);
    }
  },
  async scheduled(controller,env,ctx) {
    ctx.waitUntil((async()=>{
      if(controller.cron==='35 20 * * 5'&&env.AUTO_REWARDS_ENABLED==='true') await weeklyPlan(env,controller.scheduledTime);
      if(env.TRANSFERS_ENABLED==='true') await serial(env);
    })());
  }
};
