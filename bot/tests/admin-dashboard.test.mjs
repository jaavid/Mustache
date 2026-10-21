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
  progress:[{
    batch_id:'welcome-100-202610',source:'genesis',state:'PLANNED',
    total_raw:'2000000000000000000000',decimals:18,recipients:20,
    confirmed:0,pending:0,failed:0,not_sent:20,
    notifications_sent:0,notifications_failed:0,notifications_unknown:0,
  }],
};
function config(requests){
 return {ADMIN_TELEGRAM_USER_ID:String(uid),WALLET_SERVICE_KEY:'test-secret',WALLET:{
   async fetch(url,init){
     requests.push({url,init});
     if(url.endsWith('/weekly/preview'))return Response.json({
       state:'PREVIEW',pool:'10000',eligible:2,
       winners:[{rank:1,telegramUserId:'208627',amount:'6000',score:5000},
         {rank:2,telegramUserId:'9',amount:'4000',score:3000}],
     });
     if(url.includes('/internal/admin/batches/'))return Response.json({
       batch:{batch_id:'genesis-0',state:'APPROVED'},
       recipients:[{telegramUserId:'208627',displayName:'Javid',amount:'100',
         transactionState:'CONFIRMED',notificationState:'SENT'}],
     });
     return Response.json(overview);
   }
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

test('Admin distribution tab shows per-batch confirmations, outstanding payments and message receipts',async()=>{
  const records=[],sent=[];
  await adminCallback({id:'dist',data:'na:d',
    message:{message_id:119,chat:{id:uid,type:'private'}},from:{id:uid}},
    config(records),async(method,data)=>sent.push({method,data}));
  assert.deepEqual(sent.map(x=>x.method),['editMessageText','answerCallbackQuery']);
  const blocks=JSON.stringify(sent[0].data.rich_message.blocks);
  assert.match(blocks,/welcome-100-202610/);
  assert.match(blocks,/20/);
  assert.match(blocks,/ارسال موفق/);
  assert.equal(records.every(x=>x.init.method===undefined),true);
});
test('Admin weekly preview is read-only and shows 40-60 reward budget',async()=>{
  const requests=[],sent=[];
  await adminCallback({id:'pr',data:'na:p',
    message:{message_id:120,chat:{id:uid,type:'private'}},from:{id:uid}},
    config(requests),async(method,data)=>sent.push({method,data}));
  assert.deepEqual(sent.map(x=>x.method),['editMessageText','answerCallbackQuery']);
  assert.ok(requests.some(x=>x.url.endsWith('/internal/admin/weekly/preview')));
  assert.ok(requests.every(x=>x.init.method===undefined));
  const out=JSON.stringify(sent[0].data.rich_message.blocks);
  assert.match(out,/10000/);
  assert.match(out,/۴۰٪/);
  assert.match(out,/تراکنش یا تأیید Batch انجام نمی‌دهد/);
});
test('Batch drilldown reports per-user chain and Telegram status with private-only guard',async()=>{
  const requests=[],sent=[];
  const callback={id:'item',data:'na:i:genesis-0:0',
    message:{message_id:121,chat:{id:uid,type:'private'}},from:{id:uid}};
  await adminCallback(callback,config(requests),
    async(method,data)=>sent.push({method,data}));
  assert.deepEqual(sent.map(x=>x.method),['editMessageText','answerCallbackQuery']);
  assert.equal(requests.length,1);
  assert.match(requests[0].url,/\/internal\/admin\/batches\/genesis-0$/);
  const txt=JSON.stringify(sent[0].data.rich_message.blocks);
  assert.match(txt,/100 tNFIVE/);
  assert.match(txt,/CONFIRMED/);
  assert.match(txt,/SENT/);
  sent.length=0;requests.length=0;
  await adminCallback({...callback,from:{id:17}},config(requests),
    async(method,data)=>sent.push({method,data}));
  assert.deepEqual(sent.map(x=>x.method),['answerCallbackQuery']);
  assert.equal(requests.length,0);
});
