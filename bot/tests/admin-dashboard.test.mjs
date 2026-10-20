import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adminCommand, adminCallback} from '../src/adminDashboard.js';
import {handleTelegramUpdate,parseGameCommand} from '../src/index.js';

const uid=208627;
const overview={
  chainId:80002,walletCount:20,
  transfersEnabled:false,autoRewardsEnabled:false,symbol:'tNFIVE',
  treasury:{balance:'990000',pol:'0.29',address:'0x'+'a'.repeat(40)},
  distributor:{balance:'10000',pol:'0.02',address:'0x'+'b'.repeat(40)},
  batches:[{batch_id:'genesis-0',total_raw:'10000000000000000000000',decimals:18,state:'PLANNED'}],
  txStates:[],
};
function config(requests){
 return {ADMIN_TELEGRAM_USER_ID:String(uid),WALLET_SERVICE_KEY:'test-secret',WALLET:{
   async fetch(url,init){requests.push({url,init});return new Response(JSON.stringify(overview))}
 }};
}
test('Admin command stays hidden from unauthorized Telegram accounts and groups',async()=>{
  const requests=[],outputs=[],env=config(requests);
  await adminCommand({chat:{id:5,type:'private'},from:{id:5}},env,async(...args)=>outputs.push(args));
  assert.equal(requests.length,0);
  assert.equal(outputs[0][0],'sendMessage');
  await adminCommand({chat:{id:-100,type:'supergroup'},from:{id:uid}},env,async()=>{throw Error('cannot send in group')});
  assert.equal(requests.length,0);
  const missingConfig={...env,ADMIN_TELEGRAM_USER_ID:undefined};
  await adminCommand({chat:{id:uid,type:'private'},from:{id:uid}},missingConfig,async()=>{});
  assert.equal(requests.length,0);
});
test('Admin read-only dashboard displays wallet/treasury status as rich blocks',async()=>{
  const req=[],messages=[];
  await adminCommand({chat:{id:uid,type:'private'},from:{id:uid}},config(req),
    async(method,payload)=>messages.push({method,payload}));
  assert.equal(req.length,1);
  assert.match(req[0].url,/\/internal\/admin\/overview$/);
  assert.equal(req[0].init.headers['x-telegram-user-id'],String(uid));
  assert.equal(messages[0].method,'sendRichMessage');
  assert.equal(messages[0].payload.rich_message.is_rtl,true);
  assert.match(JSON.stringify(messages[0].payload.rich_message.blocks),/20/);
  assert.ok(messages[0].payload.reply_markup.inline_keyboard.flat().some(b=>b.callback_data==='na:b'));
});
test('Admin navigation edits the same message, never executes financial actions',async()=>{
  const req=[],out=[],env=config(req);
  await adminCallback({id:'callback',data:'na:b',message:{message_id:88,chat:{id:uid,type:'private'}},from:{id:uid}},env,
    async(method,payload)=>out.push({method,payload}));
  assert.deepEqual(out.map(o=>o.method),['editMessageText','answerCallbackQuery']);
  assert.equal(out[0].payload.message_id,88);
  assert.match(JSON.stringify(out[0].payload.rich_message.blocks),/genesis-0/);
  assert.equal(req.every(x=>x.init.method===undefined),true);
  const count=req.length;
  await adminCallback({id:'bad',data:'na:b',message:{message_id:89,chat:{id:uid,type:'private'}},from:{id:42}},env,async()=>{});
  assert.equal(req.length,count);
});
test('Telegram command dispatch routes only authenticated /admin',async()=>{
  assert.equal(parseGameCommand('/admin'),'admin');
  const req=[],out=[];
  await handleTelegramUpdate({message:{text:'/admin',chat:{id:uid,type:'private'},from:{id:uid}}},config(req),
    async(method,payload)=>out.push(method));
  assert.equal(req.length,1);
  assert.equal(out[0],'sendRichMessage');
});
