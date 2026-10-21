import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareWelcome,operatorAction,claimOperatorMilestone,acknowledgeOperatorMilestone} from '../src/operatorDistribution.js';

const TOKEN=10n**18n;
const allocations=Array.from({length:20},(_,i)=>({
  telegram_user_id:String(1000+i),
  amount_raw:(500n*TOKEN).toString(),
  operation_key:'reward:genesis-0:'+String(1000+i),
}));

function legacyDb({state='PLANNED',total='10000',jobs=0,alreadyFixed=false}={}){
  const updates=[],queries=[];
  const row={
    batch_id:'genesis-0',source:'genesis',state,
    total_raw:(BigInt(total)*TOKEN).toString(),
    decimals:18,digest:'old-digest'
  };
  const items=alreadyFixed?allocations.map(x=>({...x,amount_raw:(100n*TOKEN).toString()})):allocations;
  const db={
    queries,updates,prepare(sql){
      queries.push(sql);
      let args=[];
      return {
        bind(...v){args=v;return this;},
        async first(){
          if(sql.includes('FROM reward_batches WHERE batch_id=?'))return row;
          if(sql.includes('FROM allocations a JOIN tx_jobs'))return {total:jobs};
          throw Error('unmocked first '+sql);
        },
        async all(){
          if(sql.startsWith('SELECT telegram_user_id,amount_raw,operation_key FROM allocations'))
            return {results:items};
          if(sql.startsWith('SELECT telegram_user_id FROM wallets'))
            return {results:allocations.map(x=>({telegram_user_id:x.telegram_user_id}))};
          throw Error('unmocked all '+sql);
        },
        async run(){updates.push({sql,args});return {meta:{changes:1}};},
      };
    },
    async batch(statements){
      for(const s of statements)await s.run();
      return [];
    },
  };
  return db;
}
test('legacy Genesis draft is corrected IN PLACE to 20x100 and leaves audit trail',async()=>{
  const db=legacyDb();
  const state=await prepareWelcome({DB:db},async()=>{throw Error('MUST_REUSE_BATCH')},{
    ctx:async()=>({contract:'0x'+'1'.repeat(40)}),
  });
  assert.equal(state.batchId,'genesis-0');
  assert.equal(state.total,'2000');
  assert.equal(state.priorTotal,'10000');
  assert.equal(state.count,20);
  assert.equal(db.updates.length,22);
  const allocations= db.updates.filter(x=>x.sql.startsWith('UPDATE allocations SET'));
  assert.equal(allocations.length,20);
  assert.ok(allocations.every(x=>x.args[0]===(100n*TOKEN).toString()));
  const batch=db.updates.find(x=>x.sql.startsWith('UPDATE reward_batches'));
  assert.equal(batch.args[0],(2000n*TOKEN).toString());
  const audit=db.updates.find(x=>x.sql.startsWith('INSERT INTO audit_events'));
  assert.equal(audit.args[1],'LEGACY_GENESIS_REPLANNED_100');
  assert.ok(db.queries.every(x=>!x.includes('DELETE FROM')));
});
test('already corrected legacy draft is idempotent without extra writes or RPC calls',async()=>{
  const db=legacyDb({total:'2000',alreadyFixed:true});
  const out=await prepareWelcome({DB:db},async()=>{throw Error('MUST_REUSE')});
  assert.equal(out.state,'ALREADY_PLANNED');
  assert.equal(out.total,'2000');
  assert.equal(db.updates.length,0);
});
test('legacy draft with ANY transaction job is blocked and untouched',async()=>{
  const db=legacyDb({jobs:1});
  await assert.rejects(prepareWelcome({DB:db},async()=>{}),
    /LEGACY_GENESIS_REVIEW_REQUIRED/);
  assert.equal(db.updates.length,0);
});
test('never alter already approved old ten-thousand token genesis',async()=>{
  const db=legacyDb({state:'APPROVED'});
  await assert.rejects(prepareWelcome({DB:db},async()=>{}),
    /LEGACY_GENESIS_REVIEW_REQUIRED/);
  assert.equal(db.updates.length,0);
});
test('operator pause avoids RPC, works in outage, and does not sign any transfers',async()=>{
  const updates=[],db={prepare(sql){
    return {bind(...v){this.args=v;return this;},
      async first(){
        assert.match(sql,/operator_payout_runs/);
        return {batch_id:'genesis-0'};
      },
      async run(){updates.push(sql);return {meta:{changes:1}};},
    };
  }};
  const value=await operatorAction({DB:db},{action:'pause',kind:'welcome'},()=>{},()=>{},()=>{});
  assert.equal(value.phase,'PAUSED');
  assert.equal(value.batchId,'genesis-0');
  assert.equal(updates.length,1);
  assert.match(updates[0],/SET phase='PAUSED'/);
});
test('operator confirmation fails closed for malformed or expired one-use tickets',async()=>{
  await assert.rejects(operatorAction({DB:{}},{action:'confirm',ticket:'wrong'},()=>{},()=>{},()=>{}),
    /INVALID_OPERATOR_TICKET/);
  const db={prepare(sql){
    return {bind(){return this;},async first(){return {
      ticket:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      expires_at:Date.now()-5000,
    }}};
  }};
  await assert.rejects(operatorAction({DB:db},{action:'confirm',
      ticket:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'},()=>{},()=>{},()=>{}),
    /OPERATOR_TICKET_EXPIRED/);
});
test('operator ticket cannot begin with an unknown stage without any backend access',async()=>{
  await assert.rejects(operatorAction({DB:{}},{action:'ticket',stage:'AUTO',kind:'welcome'},
    ()=>{},()=>{},()=>{}),/INVALID_OPERATOR_STAGE/);
});

test('operator milestone claim is durable, atomic and acknowledged only once',async()=>{
  let message={batch_id:'genesis-0',phase:'PILOT_OK',source:'genesis',
    recipients:20,confirmed:1};
  let status='PENDING';
  const db={prepare(sql){
    let args=[];
    return {bind(...x){args=x;return this;},
      async first(){
        if(sql.includes('FROM operator_payout_notices n'))return status==='PENDING'?message:null;
        throw Error('unexpected select '+sql);
      },
      async run(){
        if(sql.startsWith('UPDATE operator_payout_notices SET state=')){
          if(sql.includes("state='ATTEMPTED'")){
            if(status!=='PENDING')return {meta:{changes:0}};
            status='ATTEMPTED';return {meta:{changes:1}};
          }
          if(status!=='ATTEMPTED')return {meta:{changes:0}};
          status=args[0];return {meta:{changes:1}};
        }
        throw Error('unexpected update '+sql);
      },
    };
  }};
  const first=await claimOperatorMilestone(db);
  assert.equal(first.state,'CLAIMED');
  assert.equal(first.phase,'PILOT_OK');
  assert.equal(first.recipients,20);
  assert.equal(first.confirmed,1);
  assert.equal(status,'ATTEMPTED');
  assert.equal((await claimOperatorMilestone(db)).state,'EMPTY');
  const ack=await acknowledgeOperatorMilestone(db,{batchId:'genesis-0',
    phase:'PILOT_OK',state:'SENT'});
  assert.equal(ack.state,'SENT');
  assert.equal(status,'SENT');
  assert.equal((await acknowledgeOperatorMilestone(db,{batchId:'genesis-0',
    phase:'PILOT_OK',state:'SENT'})).state,'ALREADY_RECORDED');
});
test('operator alerts reject unsafe batch ids and fake phases',async()=>{
  const db={};
  await assert.rejects(acknowledgeOperatorMilestone(db,{
    batchId:'../../../secret',phase:'PILOT_OK',state:'SENT'
  }),/INVALID_OPERATOR_NOTIFICATION/);
  await assert.rejects(acknowledgeOperatorMilestone(db,{
    batchId:'genesis-0',phase:'ALL',state:'SENT'
  }),/INVALID_OPERATOR_NOTIFICATION/);
});
