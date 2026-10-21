import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {
  WELCOME_BATCH_ID,WELCOME_TOKENS,welcomeAllocations,weeklyPreview,
  claimConfirmedNotification,acknowledgeNotification,adminBatchSummary,
  adminBatchRecipients,
} from '../src/distribution.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const fakeWallets=(count=20)=>({
  async first(sql){return null;},
  prepare(sql){
    const ids=Array.from({length:count},(_,i)=>String(i+1000));
    return {
      bind(...values){this.values=values;return this;},
      async first(){
        if(sql.includes("source='genesis'"))return null;
        throw Error('unexpected first '+sql);
      },
      async all(){
        if(sql.includes('SELECT telegram_user_id FROM wallets'))
          return {results:ids.map(telegram_user_id=>({telegram_user_id}))};
        throw Error('unexpected all '+sql);
      },
    };
  },
});

test('welcome is fixed 100 tokens per one of 20 wallets and deterministic',async()=>{
  const db=fakeWallets();
  const a=await welcomeAllocations({DB:db});
  const b=await welcomeAllocations({DB:db});
  assert.deepEqual(a,b);
  assert.equal(a.batchId,WELCOME_BATCH_ID);
  assert.equal(a.count,20);
  assert.equal(a.total,'2000');
  assert.equal(WELCOME_TOKENS,'100');
  assert.equal(a.allocations.length,20);
  assert.ok(a.allocations.every(row=>row.amount==='100'));
  assert.equal(new Set(a.allocations.map(x=>x.telegramUserId)).size,20);
});

test('existing genesis batch prevents accidental second signing campaign',async()=>{
  const db=fakeWallets();
  const original=db.prepare.bind(db);
  db.prepare=sql=>{
    const stmt=original(sql);
    if(sql.includes("source='genesis'"))stmt.first=async()=>({batch_id:'genesis-0',state:'PLANNED'});
    return stmt;
  };
  await assert.rejects(welcomeAllocations({DB:db}),/GENESIS_ALREADY_EXISTS/);
});

test('out-of-range/empty wallet list fails closed before preparing welcome transfers',async()=>{
  await assert.rejects(welcomeAllocations({DB:fakeWallets(0)}),/WELCOME_WALLET_COUNT_OUT_OF_RANGE/);
  await assert.rejects(welcomeAllocations({DB:fakeWallets(101)}),/WELCOME_WALLET_COUNT_OUT_OF_RANGE/);
});

test('weekly preview mirrors 40/60 rank-weighting and does not mutate score DB',async()=>{
  let read=0;
  const now=Date.parse('2026-10-21T09:00:00Z');
  const env={WEEKLY_POOL_TOKENS:'300',SCORES_DB:{
    prepare(sql){
      assert.match(sql,/ranked_score/);
      assert.match(sql,/game_rounds/);
      return {bind(start,end){
        assert.ok(end>start);
        return {async all(){
          read++;
          return {results:[
            {telegram_user_id:'1',ranked_points:950},
            {telegram_user_id:'2',ranked_points:800},
            {telegram_user_id:'3',ranked_points:300},
          ]};
        }};
      }};
    }
  }};
  const p=await weeklyPreview(env,now,'300',18);
  assert.equal(read,1);
  assert.equal(p.state,'PREVIEW');
  assert.equal(p.pool,'300');
  assert.equal(p.eligible,3);
  assert.equal(p.winners.reduce((sum,x)=>sum+BigInt(x.amount.split('.')[0]),0n)<=300n,true);
  assert.ok(Number(p.winners[0].amount)>Number(p.winners[2].amount));
  assert.equal(p.winners.reduce((sum,x)=>sum+Number(x.amount),0),300);
  assert.match(p.formula,/40_percent_equal_60_percent_ranked/);
});

function deliveryDB() {
  const records=new Map(),calls=[];
  let claimed=false;
  const next={
    operation_key:'reward:welcome-100-202610:208627',
    telegram_user_id:'208627',amount_raw:'100000000000000000000',
    decimals:18,source:'genesis',batch_id:'welcome-100-202610',
    tx_hash:'0x'+'a'.repeat(64),
  };
  const db={calls,records,prepare(sql){
    calls.push(sql);
    let vals=[];
    return {
      bind(...x){vals=x;return this;},
      async first(){
        if(sql.includes('LEFT JOIN reward_notifications')&&sql.includes("t.state='CONFIRMED'"))
          return claimed?null:next;
        throw Error('unexpected first '+sql);
      },
      async run(){
        if(sql.startsWith('INSERT OR IGNORE')){
          if(claimed)return {meta:{changes:0}};
          claimed=true;
          records.set(vals[0],{state:'ATTEMPTED',user:vals[1]});
          return {meta:{changes:1}};
        }
        if(sql.startsWith('UPDATE reward_notifications')){
          const r=records.get(vals[4]);
          if(!r||r.state!=='ATTEMPTED')return {meta:{changes:0}};
          Object.assign(r,{state:vals[0],messageId:vals[2],code:vals[3]});
          return {meta:{changes:1}};
        }
        throw Error('unexpected run '+sql);
      },
    };
  }};
  return db;
}
test('confirmed claim persists before delivery and never produces a duplicate claim',async()=>{
  const db=deliveryDB();
  const claimed=await claimConfirmedNotification(db,100);
  assert.equal(claimed.state,'CLAIMED');
  assert.equal(claimed.telegramUserId,'208627');
  assert.equal(claimed.amount,'100');
  assert.equal(claimed.source,'genesis');
  assert.equal(db.records.get(claimed.operationKey).state,'ATTEMPTED');
  assert.equal((await claimConfirmedNotification(db,200)).state,'EMPTY');
  const ack=await acknowledgeNotification(db,{
    operationKey:claimed.operationKey,status:'SENT',telegramMessageId:321
  },300);
  assert.equal(ack.state,'SENT');
  assert.equal(db.records.get(claimed.operationKey).messageId,321);
  assert.equal((await acknowledgeNotification(db,{
    operationKey:claimed.operationKey,status:'SENT',
  })).state,'ALREADY_RECORDED');
  assert.equal((await claimConfirmedNotification(db,400)).state,'EMPTY');
});
test('notification acknowledgement validates identity, shape, status and safe failure code',async()=>{
  const db=deliveryDB();
  const item=await claimConfirmedNotification(db);
  await assert.rejects(
    acknowledgeNotification(db,{operationKey:'invalid',status:'SENT'}),/INVALID_OPERATION_KEY/);
  await assert.rejects(
    acknowledgeNotification(db,{operationKey:item.operationKey,status:'RETRY'}),/INVALID_NOTIFICATION_STATE/);
  assert.equal((await acknowledgeNotification(db,{
    operationKey:item.operationKey,status:'FAILED',reason:'sensitive upstream exception',
  })).state,'FAILED');
  assert.equal(db.records.get(item.operationKey).code,'SEND_FAILED');
});
