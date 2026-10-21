import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {WalletSerial} from '../src/index.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

test('pause and cron tick share a serialized execution queue',async()=>{
  let releasePause,signalStarted;
  const waiting=new Promise(resolve=>{releasePause=resolve;});
  const started=new Promise(resolve=>{signalStarted=resolve;});
  const changes=[];
  const env={DB:{prepare(sql){
    return {bind(...values){this.values=values;return this;},
      async first(){
        if(sql.includes('SELECT r.batch_id FROM operator_payout_runs'))
          return {batch_id:'genesis-0'};
        throw Error('unexpected query');
      },
      async run(){
        if(sql.includes("SET phase='PAUSED'")){
          signalStarted();
          await waiting;
          changes.push('pause-committed');
          return {meta:{changes:1}};
        }
        if(sql.includes('operator_payout_notices')){
          changes.push('notice-written');
          return {meta:{changes:1}};
        }
        throw Error('unexpected mutation');
      }
    };
  }}};
  const object=new WalletSerial({},env);
  const pendingPause=object.fetch(new Request('https://internal/operator',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'pause',kind:'welcome'}),
  }));
  await started;
  let tickFinished=false;
  const pendingTick=object.fetch(new Request('https://internal/run',{
    method:'POST',
  })).then(async response=>{
    tickFinished=true;
    changes.push('tick-finished');
    return response.json();
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(tickFinished,false);
  releasePause();
  const [pause,tick]=await Promise.all([pendingPause,pendingTick]);
  assert.equal((await pause.json()).phase,'PAUSED');
  assert.deepEqual(tick,{state:'DISABLED',reason:'MANUAL_MODE_REQUIRED'});
  assert.deepEqual(changes,['pause-committed','notice-written','tick-finished']);
});
