import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWithdraw, walletCommand, confirmWalletCallback, handleWalletNavigation, ensureTelegramWallet } from '../src/walletCommands.js';
import { parseGameCommand, handleTelegramUpdate } from '../src/index.js';

const owner = { id: 208627, first_name: 'Javid' };
const address = '0x' + '1'.repeat(40);
const confirmationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
function mockEnv(records) {
  return { WALLET_SERVICE_KEY: 'test-shared-key', WALLET: {
    async fetch(url, opts) {
      records.push({ url, opts });
      if (url.includes('/ensure')) return new Response(JSON.stringify({ telegramUserId: String(owner.id), address, created: false }));
      if (url.endsWith('/internal/wallet')) return new Response(JSON.stringify({ address, balance: '42', symbol: 'tNFIVE', pol: '0', explorer: 'fake' }));
      if (url.endsWith('/internal/history')) return new Response(JSON.stringify({
        rewards: [{ batchId:'genesis-0', amountRaw:'2000000000000000000', decimals:18, state:'CONFIRMED', txHash: '0x'+'a'.repeat(64) }],
        withdrawals: [],
      }));
      if (url.endsWith('/internal/withdrawals')) return new Response(JSON.stringify({ requestId:confirmationId, destination:address, amount:'1' }));
      return new Response(JSON.stringify({ state:'READY' }));
    },
  } };
}
test('existing slash commands and strict withdrawal syntax', () => {
  assert.equal(parseGameCommand('/wallet@RJTtobot'),'wallet');
  assert.equal(parseGameCommand('/withdraw@anotherbot'),null);
  assert.deepEqual(parseWithdraw('/withdraw 25 ' + address), { amount:'25',destination:address });
  assert.equal(parseWithdraw('/withdraw 25 banana'),null);
  assert.equal(parseWithdraw('/withdraw -1 ' + address),null);
  assert.equal(parseWithdraw('/withdraw 25 ' + address + ' extra'),null);
});
test('private only: group wallet command has no wallet backend access', async () => {
  const requests=[],send=[];
  const env=mockEnv(requests);
  await walletCommand({ text:'/wallet', chat:{ id:-100, type:'supergroup' }, from:owner },'wallet',env,async(method,data)=>send.push({method,data}));
  assert.equal(requests.length,0);
  assert.equal(send[0].method,'sendMessage');
  assert.match(send[0].data.text,/خصوصی/);
  assert.match(send[0].data.reply_markup.inline_keyboard[0][0].url,/t.me/);
});
test('wallet automatically ensured for Telegram identity; rich card with explorer and keyboard',async()=>{
  const requests=[],messages=[];
  const env=mockEnv(requests);
  await walletCommand({text:'/wallet',chat:{id:owner.id,type:'private'},from:owner},'wallet',env,
    async(method,data)=>messages.push({method,data}));
  assert.equal(requests.length,2);
  assert.equal(requests[0].opts.headers['x-telegram-user-id'],String(owner.id));
  assert.equal(requests[0].opts.method,'POST');
  assert.match(requests[0].url,/\/ensure$/);
  assert.equal(messages[0].method,'sendRichMessage');
  assert.equal(messages[0].data.rich_message.is_rtl,true);
  assert.equal(messages[0].data.rich_message.blocks.find(b=>b.type==='table').is_bordered,true);
  assert.ok(messages[0].data.reply_markup.inline_keyboard.flat().some(x=>x.callback_data==='nw:t'));
  assert.ok(messages[0].data.reply_markup.inline_keyboard.flat().some(x=>x.url?.includes('/address/')));
});
test('unsupported rich Telegram method falls back to text and keeps keyboard',async()=>{
  const requests=[],calls=[];
  await walletCommand({text:'/wallet',chat:{id:owner.id,type:'private'},from:owner},'wallet',mockEnv(requests),
    async(method,data)=>{
      calls.push({method,data});
      if(method==='sendRichMessage') throw new Error('TELEGRAM_RICH_UNSUPPORTED');
    });
  assert.deepEqual(calls.map(x=>x.method),['sendRichMessage','sendMessage']);
  assert.match(calls[1].data.text,/42 tNFIVE/);
  assert.ok(calls[1].data.reply_markup.inline_keyboard.length>0);
});
test('reward history shows statuses, amounts, transaction hash and navigation',async()=>{
  const requests=[],calls=[];
  await walletCommand({text:'/rewards',chat:{id:owner.id,type:'private'},from:owner},'rewards',mockEnv(requests),
    async(method,data)=>calls.push({method,data}));
  assert.equal(calls[0].method,'sendRichMessage');
  assert.match(JSON.stringify(calls[0].data.rich_message.blocks),/2/);
  assert.match(JSON.stringify(calls[0].data.rich_message.blocks),/تأییدشده/);
  assert.match(JSON.stringify(calls[0].data.rich_message.blocks),/amoy.polygonscan.com/);
});
test('navigation edits existing Telegram message and enforces callback chat owner',async()=>{
  const requests=[],out=[];
  const env=mockEnv(requests);
  await handleWalletNavigation({id:'c1',data:'nw:r',from:owner,message:{chat:{id:owner.id,type:'private'},message_id:30}},
    env,async(method,data)=>out.push({method,data}));
  assert.deepEqual(out.map(x=>x.method),['editMessageText','answerCallbackQuery']);
  assert.equal(out[0].data.message_id,30);
  assert.equal(requests[0].opts.headers['x-telegram-user-id'],String(owner.id));
  const previous=requests.length;
  await handleWalletNavigation({id:'c2',data:'nw:w',from:{id:123},message:{chat:{id:owner.id,type:'private'},message_id:31}},
    env,async()=>{});
  assert.equal(requests.length,previous);
});
test('two-step withdrawal never confirms on initial request and callback is owner-bound',async()=>{
  const requests=[],out=[];
  const env=mockEnv(requests);
  await walletCommand({text:'/withdraw 1 '+address,from:owner,chat:{id:owner.id,type:'private'}},'withdraw',env,
    async(method,data)=>out.push({method,data}));
  assert.ok(requests.some(r=>r.url.endsWith('/internal/withdrawals')));
  assert.equal(requests.some(r=>r.url.endsWith('/confirm')),false);
  assert.equal(out[0].method,'sendRichMessage');
  assert.equal(out[0].data.reply_markup.inline_keyboard[0][0].callback_data,'wd:'+confirmationId);
  await confirmWalletCallback({id:'c2',data:'wd:'+confirmationId,from:owner,message:{chat:{id:owner.id,type:'private'}}},
    env,async()=>{});
  assert.ok(requests.some(r=>r.url.endsWith('/confirm')));
});
test('authenticated game callback provisions wallet and never blocks game if wallet unavailable',async()=>{
  const requests=[],sent=[];
  const env={...mockEnv(requests),DB:{async batch(){},prepare(sql){return {bind(){return this},async run(){}}}},GAME_URL:'https://mustache.alexa.ir/'};
  // Use existing game command path to avoid stubbing the session database.
  await handleTelegramUpdate({message:{chat:{id:owner.id,type:'private'},from:owner,text:'/play'}},env,
    async(method,data)=>sent.push({method,data}));
  assert.equal(requests.length,1);
  assert.equal(sent.at(-1).method,'sendGame');
  const broken={...env,WALLET:{async fetch(){throw new Error('RPC_DOWN')}}};
  sent.length=0;
  await handleTelegramUpdate({message:{chat:{id:owner.id,type:'private'},from:owner,text:'/play'}},broken,
    async(method,data)=>sent.push({method,data}));
  assert.equal(sent.at(-1).method,'sendGame');
});
test('invalid bot identity cannot auto-create wallet',async()=>{
  const requests=[];
  const env=mockEnv(requests);
  assert.equal(await ensureTelegramWallet(env,{id:3,is_bot:true}),null);
  assert.equal(await ensureTelegramWallet(env,{id:0}),null);
  assert.equal(requests.length,0);
});

test('official Telegram Game Card callback provisions by authenticated callback.from without blocking session',async()=>{
  const requests=[],out=[];
  const env={...mockEnv(requests),DB:{
    prepare(){return {bind(){return this;}}},
    async batch(statements){return statements.map(()=>({meta:{changes:1}}))}
  }};
  await handleTelegramUpdate({callback_query:{
    id:'cb-game',game_short_name:'mustache',from:owner,
    message:{chat:{id:owner.id,type:'private'},message_id:100}
  }},env,async(method,data)=>out.push({method,data}));
  assert.equal(requests.length,1);
  assert.match(requests[0].url,/\/internal\/wallet\/ensure$/);
  assert.equal(requests[0].opts.headers['x-telegram-user-id'],String(owner.id));
  assert.equal(out[0].method,'answerCallbackQuery');
  assert.match(out[0].data.url,/tg_session=/);
});

test('existing wallets remain readable while the new /ensure endpoint is not yet deployed',async()=>{
  const requests=[],sent=[];
  const original=mockEnv(requests);
  const env={...original,WALLET:{async fetch(url,opts){
    requests.push({url,opts});
    if(url.endsWith('/internal/wallet/ensure')) return new Response('Not found',{status:404});
    if(url.endsWith('/internal/wallet')) return new Response(JSON.stringify({
      address,balance:'13',symbol:'tNFIVE',pol:'0.01'
    }));
    throw Error('Unexpected route');
  }}};
  await walletCommand({text:'/wallet',chat:{id:owner.id,type:'private'},from:owner},'wallet',env,
    async(method,data)=>sent.push({method,data}));
  assert.equal(requests.length,2);
  assert.equal(sent[0].method,'sendRichMessage');
  assert.match(JSON.stringify(sent[0].data.rich_message.blocks),/13/);
});

test('Polygon Faucet navigation shows authenticated custodial address, Amoy chain and POL-only guidance',async()=>{
  const requests=[],messages=[];
  const env=mockEnv(requests);
  await handleWalletNavigation({
    id:'faucet-cb',data:'nw:f',from:owner,
    message:{chat:{id:owner.id,type:'private'},message_id:77}
  },env,async(method,data)=>messages.push({method,data}));
  assert.deepEqual(messages.map(x=>x.method),['editMessageText','answerCallbackQuery']);
  assert.equal(messages[0].data.message_id,77);
  const doc=messages[0].data.rich_message;
  const paragraphs=JSON.stringify(doc.blocks);
  assert.match(paragraphs,/Polygon Amoy/);
  assert.match(paragraphs,/80002/);
  assert.match(paragraphs,/POL تستی/);
  assert.match(paragraphs,/Faucet توکن tNFIVE نمی‌دهد/);
  assert.match(paragraphs,/N5 کارمزد برداشت/);
  assert.match(paragraphs,/Seed Phrase/);
  assert.match(paragraphs,new RegExp(address));
  assert.ok(messages[0].data.reply_markup.inline_keyboard.flat()
    .some(button=>button.url==='https://faucet.polygon.technology/'));
  assert.ok(messages[0].data.reply_markup.inline_keyboard.flat()
    .some(button=>button.callback_data==='nw:w'));
  assert.equal(requests.some(r=>r.url.includes('/internal/withdrawals')),false);
  assert.equal(requests.some(r=>r.opts.method==='POST' && !r.url.endsWith('/ensure')),false);
  assert.ok(requests.every(r=>r.opts.headers['x-telegram-user-id']===String(owner.id)));
});
test('Faucet button is available from both Wallet and withdrawal guides; never gates withdrawals',async()=>{
  const records=[],calls=[];
  const send=async(method,data)=>calls.push({method,data});
  await walletCommand({text:'/wallet',chat:{id:owner.id,type:'private'},from:owner},'wallet',mockEnv(records),send);
  assert.ok(calls[0].data.reply_markup.inline_keyboard.flat()
    .some(button=>button.callback_data==='nw:f'));
  calls.length=0;
  await walletCommand({text:'/withdraw',chat:{id:owner.id,type:'private'},from:owner},'withdraw',mockEnv(records),send);
  const guide=JSON.stringify(calls[0].data.rich_message.blocks);
  assert.match(guide,/برای دریافت در کیف پول شخصی POL لازم نیست/);
  assert.match(guide,/Faucet توکن tNFIVE نمی‌دهد/);
  assert.ok(calls[0].data.reply_markup.inline_keyboard.flat()
    .some(button=>button.callback_data==='nw:f'));
  assert.equal(records.some(r=>r.url.endsWith('/internal/withdrawals')),false);
});
test('Faucet guide remains usable if Telegram rich messages are unsupported',async()=>{
  const records=[],sent=[];
  await handleWalletNavigation({
    id:'callback-f',data:'nw:f',from:owner,
    message:{chat:{id:owner.id,type:'private'},message_id:24}
  },mockEnv(records),async(method,data)=>{
    sent.push({method,data});
    if(method==='editMessageText' && data.rich_message)
      throw new Error('TELEGRAM_RICH_UNSUPPORTED');
  });
  assert.deepEqual(sent.map(x=>x.method),
    ['editMessageText','editMessageText','answerCallbackQuery']);
  assert.match(sent[1].data.text,/https:\/\/faucet\.polygon\.technology\//);
  assert.match(sent[1].data.text,/POL تستی/);
  assert.match(sent[1].data.text,new RegExp(address));
});
test('Faucet navigation is private and does not reveal a user wallet to another account',async()=>{
  const requests=[],out=[];
  await handleWalletNavigation({
    id:'faucet-cb',data:'nw:f',from:{id:42},
    message:{chat:{id:owner.id,type:'private'},message_id:77}
  },mockEnv(requests),async(method,data)=>out.push({method,data}));
  assert.equal(requests.length,0);
  assert.deepEqual(out.map(o=>o.method),['answerCallbackQuery']);
});

test('withdrawal instructions expose copy-text template in rich message and fallback',async()=>{
  const requests=[],calls=[];
  await walletCommand({text:'/withdraw',from:owner,chat:{id:owner.id,type:'private'}},
    'withdraw',mockEnv(requests),async(method,data)=>calls.push({method,data}));
  assert.equal(calls.length,1);
  assert.equal(calls[0].method,'sendRichMessage');
  const msg=calls[0].data;
  const button=msg.reply_markup.inline_keyboard.flat().find(b=>b.copy_text);
  assert.equal(button.copy_text.text,'/withdraw 25 0xYourPolygonAddress');
  assert.equal(button.style,'primary');
  assert.match(JSON.stringify(msg.rich_message.blocks),/آدرس واقعی/);
  assert.equal(requests.length,0);
  assert.equal(parseWithdraw(button.copy_text.text),null);
});

test('withdraw help plain-text fallback retains the same clipboard button',async()=>{
  const out=[];
  await walletCommand({text:'/withdraw',from:owner,chat:{id:owner.id,type:'private'}},'withdraw',
    mockEnv([]),async(method,data)=>{
      out.push({method,data});
      if(method==='sendRichMessage')throw new Error('TELEGRAM_RICH_UNSUPPORTED');
    });
  assert.deepEqual(out.map(x=>x.method),['sendRichMessage','sendMessage']);
  assert.match(out[1].data.text,/Paste کن/);
  assert.equal(out[1].data.reply_markup.inline_keyboard.flat()
    .find(x=>x.copy_text)?.copy_text.text,'/withdraw 25 0xYourPolygonAddress');
});

test('wallet and faucet offer copy button for only the authenticated public wallet address',async()=>{
  const requests=[],walletMessages=[];
  await walletCommand({text:'/wallet',from:owner,chat:{id:owner.id,type:'private'}},
    'wallet',mockEnv(requests),async(method,data)=>walletMessages.push({method,data}));
  assert.equal(walletMessages[0].data.reply_markup.inline_keyboard.flat()
    .find(x=>x.copy_text)?.copy_text.text,address);
  const faucet=[];
  await handleWalletNavigation({
    id:'f1',data:'nw:f',from:owner,
    message:{chat:{id:owner.id,type:'private'},message_id:88}
  },mockEnv(requests),async(method,data)=>faucet.push({method,data}));
  assert.equal(faucet[0].data.reply_markup.inline_keyboard.flat()
    .find(x=>x.copy_text)?.copy_text.text,address);
  assert.equal(requests.some(x=>x.url.includes('/withdrawals')),false);
});

test('a temporary Amoy Wallet 503 displays contextual network/service warning with one-tap retry',async()=>{
  const requests=[],messages=[];
  const env={...mockEnv(requests),ADMIN_TELEGRAM_USER_ID:String(owner.id),WALLET:{
    async fetch(url,opts){
      requests.push({url,opts});
      if(url.endsWith('/ensure'))return Response.json({created:false,address});
      if(url.endsWith('/internal/wallet'))return Response.json({error:'OPERATION_FAILED'},{status:503});
      throw Error('Unexpected endpoint');
    }
  }};
  await walletCommand({text:'/wallet',from:owner,chat:{id:owner.id,type:'private'}},
    'wallet',env,async(method,data)=>messages.push({method,data}));
  assert.deepEqual(messages.map(x=>x.method),['sendMessage']);
  const failure=messages[0].data;
  assert.match(failure.text,/Polygon Amoy/);
  assert.match(failure.text,/ممکن است/);
  assert.match(failure.text,/سرویس Wallet/);
  assert.match(failure.text,/از دست رفتن توکن‌ها/);
  assert.match(failure.text,/\/walletcheck/);
  assert.equal(failure.reply_markup.inline_keyboard[0][0].callback_data,'nw:retry:w');
  assert.equal(failure.reply_markup.inline_keyboard[0][0].text,'🔄 تلاش مجدد');
  assert.ok(requests.every(x=>!x.url.includes('withdrawals')));
});
test('configuration or unauthorized Worker response does not falsely blame Polygon RPC',async()=>{
  const out=[];
  await walletCommand({text:'/wallet',from:owner,chat:{id:owner.id,type:'private'}},
    'wallet',{...mockEnv([]),WALLET_SERVICE_KEY:undefined},
    async(method,data)=>out.push({method,data}));
  assert.equal(out[0].method,'sendMessage');
  assert.match(out[0].data.text,/تنظیمات یا پاسخ سرویس Wallet/);
  assert.doesNotMatch(out[0].data.text,/Polygon Amoy/);
  assert.equal(out[0].data.reply_markup.inline_keyboard[0][0].callback_data,'nw:retry:w');
});
test('retry wallet callback replaces previous error with live wallet information after recovery',async()=>{
  const calls=[],requests=[];
  await handleWalletNavigation({id:'retry-1',data:'nw:retry:w',from:owner,
    message:{chat:{id:owner.id,type:'private'},message_id:201}},
    mockEnv(requests),async(method,data)=>calls.push({method,data}));
  assert.deepEqual(calls.map(x=>x.method),['editMessageText','answerCallbackQuery']);
  assert.equal(calls[0].data.message_id,201);
  assert.match(JSON.stringify(calls[0].data.rich_message.blocks),/42/);
  assert.ok(requests.some(x=>x.url.endsWith('/internal/wallet')));
  assert.ok(requests.every(x=>!x.url.includes('/withdrawals')));
});
test('retry of unavailable Wallet replaces error card and acknowledges callback without duplicate sends',async()=>{
  const sent=[],requests=[];
  const env={...mockEnv(requests),WALLET:{async fetch(url,opts){
    requests.push({url,opts});
    if(url.endsWith('/ensure'))return Response.json({created:false,address});
    return Response.json({error:'OPERATION_FAILED'},{status:503});
  }}};
  await handleWalletNavigation({id:'retry-2',data:'nw:retry:w',from:owner,
    message:{chat:{id:owner.id,type:'private'},message_id:202}},
    env,async(method,data)=>sent.push({method,data}));
  assert.deepEqual(sent.map(x=>x.method),['editMessageText','answerCallbackQuery']);
  assert.equal(sent[0].data.reply_markup.inline_keyboard[0][0].callback_data,'nw:retry:w');
  assert.match(sent[0].data.text,/ممکن است/);
  assert.equal(sent[0].data.message_id,202);
});
test('history retry remains read-only and keeps correct section',async()=>{
  const calls=[],requests=[];
  await handleWalletNavigation({id:'retry-t',data:'nw:retry:t',from:owner,
    message:{chat:{id:owner.id,type:'private'},message_id:203}},
    mockEnv(requests),async(method,data)=>calls.push({method,data}));
  assert.deepEqual(calls.map(x=>x.method),['editMessageText','answerCallbackQuery']);
  assert.match(JSON.stringify(calls[0].data.rich_message.blocks),/تاریخچه/);
  assert.ok(requests.some(x=>x.url.endsWith('/internal/history')));
  assert.equal(requests.some(x=>x.url.includes('/withdrawals')),false);
});
test('retry never exposes wallet details across chats or triggers withdrawal operations',async()=>{
  const requests=[],out=[];
  const env=mockEnv(requests);
  await handleWalletNavigation({id:'retry-other',data:'nw:retry:w',from:{id:11},
    message:{chat:{id:owner.id,type:'private'},message_id:204}},
    env,async(method,data)=>out.push({method,data}));
  assert.deepEqual(out.map(x=>x.method),['answerCallbackQuery']);
  assert.equal(requests.length,0);
  out.length=0;
  await handleWalletNavigation({id:'retry-x',data:'nw:retry:x',from:owner,
    message:{chat:{id:owner.id,type:'private'},message_id:205}},
    env,async(method,data)=>out.push({method,data}));
  assert.deepEqual(out.map(x=>x.method),['answerCallbackQuery']);
  assert.equal(requests.length,0);
});
test('failures sending Telegram messages are not misreported as Polygon Wallet outages',async()=>{
  await assert.rejects(
    walletCommand({text:'/wallet',from:owner,chat:{id:owner.id,type:'private'}},
      'wallet',mockEnv([]),async()=>{throw new Error('TELEGRAM_DELIVERY_ERROR');}),
    /TELEGRAM_DELIVERY_ERROR/
  );
});
test('withdraw submission error offers transaction inspection but never a retry button',async()=>{
  const calls=[],requests=[];
  const env={...mockEnv(requests),WALLET:{async fetch(url,opts){
    requests.push({url,opts});
    if(url.endsWith('/ensure'))return Response.json({created:false,address});
    return Response.json({error:'OPERATION_FAILED'},{status:503});
  }}};
  await walletCommand({text:'/withdraw 25 '+address,from:owner,
    chat:{id:owner.id,type:'private'}},'withdraw',env,
    async(method,data)=>calls.push({method,data}));
  assert.equal(calls[0].method,'sendMessage');
  assert.match(calls[0].data.text,/وضعیت درخواست برداشت نامشخص/);
  assert.ok(calls[0].data.reply_markup.inline_keyboard.flat().some(x=>x.callback_data==='nw:t'));
  assert.ok(calls[0].data.reply_markup.inline_keyboard.flat().every(x=>!String(x.callback_data).includes('retry')));
  assert.equal(requests.filter(x=>x.url.endsWith('/internal/withdrawals')).length,1);
});

test('CodeRabbit regression: direct /wallet before /start offers unobtrusive main keyboard setup',async()=>{
  const requests=[],messages=[];
  await walletCommand({text:'/wallet',chat:{id:owner.id,type:'private'},from:owner},
    'wallet',mockEnv(requests),async(method,data)=>messages.push({method,data}));
  assert.deepEqual(messages.map(x=>x.method),['sendRichMessage']);
  const inline=messages[0].data.reply_markup.inline_keyboard.flat();
  assert.ok(inline.some(b=>b.callback_data==='nw:home'));
  assert.ok(inline.some(b=>b.callback_data==='nw:r'));
  assert.ok(inline.every(b=>!b.url?.includes('?game=')));
});

test('explicit main-menu action installs 3 colored persistent buttons without touching Wallet backend',async()=>{
  const requests=[],messages=[];
  await handleWalletNavigation({
    id:'nav-main',data:'nw:home',from:owner,
    message:{chat:{id:owner.id,type:'private'},message_id:321},
  },mockEnv(requests),async(method,data)=>messages.push({method,data}));
  assert.deepEqual(messages.map(x=>x.method),['sendMessage','answerCallbackQuery']);
  assert.equal(messages[0].data.reply_markup.is_persistent,true);
  assert.deepEqual(messages[0].data.reply_markup.keyboard[0].map(b=>b.style),
    ['danger','success','primary']);
  assert.equal(requests.length,0);
});

test('untrusted group or another Telegram account cannot install main menu through wallet button',async()=>{
  const requests=[],other=[],group=[];
  await handleWalletNavigation({
    id:'not-owner',data:'nw:home',from:{id:14},
    message:{chat:{id:owner.id,type:'private'},message_id:44},
  },mockEnv(requests),async(method,data)=>other.push({method,data}));
  await handleWalletNavigation({
    id:'in-group',data:'nw:home',from:owner,
    message:{chat:{id:-100,type:'supergroup'},message_id:45},
  },mockEnv(requests),async(method,data)=>group.push({method,data}));
  assert.deepEqual(other.map(x=>x.method),['answerCallbackQuery']);
  assert.deepEqual(group.map(x=>x.method),['answerCallbackQuery']);
  assert.equal(requests.length,0);
});

test('temporary Wallet failure keeps retry and one-click navigation recovery',async()=>{
  const outputs=[];
  await walletCommand({text:'/wallet',chat:{id:owner.id,type:'private'},from:owner},
    'wallet',{...mockEnv([]),WALLET_SERVICE_KEY:undefined},
    async(method,data)=>outputs.push({method,data}));
  assert.equal(outputs[0].method,'sendMessage');
  const keyboard=outputs[0].data.reply_markup.inline_keyboard;
  assert.ok(keyboard.flat().some(b=>b.callback_data==='nw:retry:w'));
  assert.ok(keyboard.flat().some(b=>b.callback_data==='nw:home'));
  assert.equal(keyboard.flat().some(b=>b.callback_data==='wd:confirm'),false);
});
