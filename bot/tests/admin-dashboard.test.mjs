import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adminCommand, adminCallback, decimalLabel, compactAddress} from '../src/adminDashboard.js';
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
  assert.match(out,/10,000/);
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

test('financial admin values round safely without losing exact copyable address',async()=>{
  assert.equal(decimalLabel('990000'),'990,000');
  assert.equal(decimalLabel('10000.0'),'10,000');
  assert.equal(decimalLabel('0.392532963324678353',4),'0.3925');
  assert.equal(decimalLabel('0.199999999999999999',4),'0.2');
  assert.equal(decimalLabel('999.999',2),'1,000');
  assert.equal(decimalLabel('not-a-value'),'—');
  assert.equal(compactAddress('0xFbeA2a974efb786Aa052e7ef1ac31fD5E4c1351c'),'0xFbeA2a…4c1351c');
  const requests=[],sent=[];
  const env=config(requests);
  env.WALLET.fetch=async()=>Response.json({
    ...overview,treasury:{balance:'970000',pol:'0.187411864466946149'},
    distributor:{balance:'30000',pol:'0.2',
      address:'0xFbeA2a974efb786Aa052e7ef1ac31fD5E4c1351c'},
  });
  await adminCallback({id:'format',data:'na:f',
    message:{message_id:23,chat:{id:uid,type:'private'}},from:{id:uid}},
    env,async(method,data)=>sent.push({method,data}));
  const text=JSON.stringify(sent[0].data.rich_message.blocks);
  assert.match(text,/970,000/);
  assert.match(text,/0\.1874/);
  assert.match(text,/30,000/);
  assert.match(text,/0xFbeA2a…4c1351c/);
  assert.doesNotMatch(text,/0\.1874118644/);
  assert.equal(sent[0].data.reply_markup.inline_keyboard[0][0].copy_text.text,
    '0xFbeA2a974efb786Aa052e7ef1ac31fD5E4c1351c');
});

function operatorEnvironment(logs) {
  const ticket='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const operational={
    chainId:80002,wallets:20,availableTokens:'30000',availablePol:'0.2',
    manualOnly:true,transfersEnabled:false,autoRewardsEnabled:false,
    signer:'0xFbeA2a974efb786Aa052e7ef1ac31fD5E4c1351c',approvedWeeklyPool:'10000',
    legacy:{batchId:'genesis-0',state:'PLANNED',total:'10000',
      canConvert:true,alreadyFixed:false},runs:[],
  };
  return {
    ticket,
    env:{ADMIN_TELEGRAM_USER_ID:String(uid),WALLET_SERVICE_KEY:'test-service',WALLET:{
      async fetch(url,opts) {
        const body=opts.body?JSON.parse(opts.body):{};
        logs.push({url,method:opts.method||'GET',body});
        if(url.endsWith('/internal/admin/operator')){
          if(body.action==='status')return Response.json(operational);
          if(body.action==='preview')return Response.json({
            kind:body.kind,batchId:body.kind==='welcome'?'genesis-0':'weekly-123',
            state:'PLANNED',total:body.kind==='welcome'?'10000':'10000',
            legacyNeedsCorrection:body.kind==='welcome',
            overview:operational,
          });
          if(body.action==='prepare')return Response.json({
            batchId:'genesis-0',state:'PLANNED',total:'2000'
          });
          if(body.action==='ticket')return Response.json({
            state:'AWAITING_SECOND_CONFIRMATION',stage:body.stage,batchId:'genesis-0',
            recipients:20,remaining:20,budget:'2000',estimatedGasPol:'0.08',ticket,
          });
          if(body.action==='confirm')return Response.json({
            batchId:'genesis-0',phase:'PILOT',state:'QUEUED'
          });
          if(body.action==='pause')return Response.json({
            batchId:'genesis-0',phase:'PAUSED'
          });
        }
        return Response.json(overview);
      },
    }},
  };
}
function callback(data){
  return {id:'cb-'+data,data,message:{message_id:77,chat:{id:uid,type:'private'}},
    from:{id:uid}};
}
test('operator panel is private and never signs on navigation or preparation',async()=>{
  const logs=[],out=[],{env}=operatorEnvironment(logs);
  await adminCallback(callback('na:o'),env,async(method,data)=>out.push({method,data}));
  assert.deepEqual(out.map(x=>x.method),['editMessageText','answerCallbackQuery']);
  assert.equal(logs[0].body.action,'status');
  assert.match(JSON.stringify(out[0].data.rich_message.blocks),/30,000/);
  assert.equal(out[0].data.reply_markup.inline_keyboard[0][0].callback_data,'na:op:w');
  out.length=0;
  await adminCallback(callback('na:op:w'),env,async(method,data)=>out.push({method,data}));
  const buttons=out[0].data.reply_markup.inline_keyboard.flat();
  assert.ok(buttons.some(b=>b.callback_data==='na:pr:w'));
  assert.ok(buttons.every(b=>b.callback_data!=='na:tk:w:P'));
  out.length=0;
  await adminCallback(callback('na:pr:w'),env,async(method,data)=>out.push({method,data}));
  assert.deepEqual(logs.slice(-2).map(x=>x.body.action),['prepare','preview']);
  assert.equal(logs.every(x=>!['confirm','approve','process'].includes(x.body.action)),true);
});
test('pilot is a two-step flow with single-use server-side challenge',async()=>{
  const logs=[],out=[],{env,ticket}=operatorEnvironment(logs);
  await adminCallback(callback('na:tk:w:P'),env,
    async(method,data)=>out.push({method,data}));
  assert.deepEqual(out.map(x=>x.method),['editMessageText','answerCallbackQuery']);
  assert.equal(logs.at(-1).body.action,'ticket');
  assert.equal(logs.at(-1).body.stage,'PILOT');
  const c=out[0].data.reply_markup.inline_keyboard[0][0];
  assert.equal(c.callback_data,'na:go:'+ticket);
  assert.match(JSON.stringify(out[0].data.rich_message.blocks),/۲|تست فقط یک نفر/);
  assert.equal(logs.some(x=>x.body.action==='confirm'),false);
  out.length=0;
  await adminCallback(callback('na:go:'+ticket),env,
    async(method,data)=>out.push({method,data}));
  assert.equal(logs.at(-1).body.action,'confirm');
  assert.equal(logs.at(-1).body.ticket,ticket);
  assert.match(JSON.stringify(out[0].data.rich_message.blocks),/QUEUED|شروع کنترل‌شده|قرار گرفت/);
});
test('unauthorized accounts and groups never access reward payout operator endpoints',async()=>{
  const logs=[],calls=[],{env}=operatorEnvironment(logs);
  const forged={...callback('na:go:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'),
    from:{id:uid+1}};
  await adminCallback(forged,env,async(method,data)=>calls.push({method,data}));
  const group={...callback('na:tk:w:P'),
    message:{message_id:75,chat:{id:-100,type:'supergroup'}}};
  await adminCallback(group,env,async(method,data)=>calls.push({method,data}));
  assert.equal(logs.length,0);
  assert.deepEqual(calls.map(x=>x.method),['answerCallbackQuery','answerCallbackQuery']);
});
