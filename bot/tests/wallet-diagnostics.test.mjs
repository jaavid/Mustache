import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseWallet, walletDiagnosticCommand } from '../src/walletDiagnostics.js';
import { handleTelegramUpdate, parseGameCommand } from '../src/index.js';

const user={id:208627,first_name:'Operator'};
const wallet='0x'+'1'.repeat(40);
function envFor(log,requests) {
  return {
    ADMIN_TELEGRAM_USER_ID:'208627',
    WALLET_SERVICE_KEY:'shared-internal-token',
    WALLET:{
      async fetch(url,options){
        requests.push({url,options});
        if(url.endsWith('/health'))return new Response(JSON.stringify({
          service:'n5-wallet-service',chainId:80002,transfersEnabled:false,autoRewardsEnabled:false
        }),{status:200});
        if(url.endsWith('/internal/history'))return new Response(JSON.stringify({rewards:[],withdrawals:[]}),{status:200});
        if(url.endsWith('/internal/wallet/ensure'))return new Response(JSON.stringify({created:false,address:wallet}),{status:200});
        if(url.endsWith('/internal/wallet'))return new Response(JSON.stringify({
          address:wallet,balance:'42',symbol:'tNFIVE',pol:'0.01'
        }),{status:200});
        throw Error('unexpected route: '+url);
      }
    }
  };
}
test('wallet deep-link /start wallet shows Wallet rather than launching Game',async()=>{
  const requests=[],messages=[],env=envFor([],requests);
  assert.equal(parseGameCommand('/start wallet'),'start');
  await handleTelegramUpdate({message:{text:'/start wallet',chat:{id:user.id,type:'private'},from:user}},env,
    async(method,data)=>messages.push({method,data}));
  assert.equal(messages.length,1);
  assert.equal(messages[0].method,'sendRichMessage');
  assert.equal(messages.some(m=>m.method==='sendGame'),false);
  assert.match(JSON.stringify(messages[0].data.rich_message),/42/);
  assert.equal(requests.some(x=>x.url.endsWith('/internal/wallet')),true);
});
test('deep link wallet bot suffix also resolves and other /start behavior unchanged',async()=>{
  const requests=[],sent=[];
  const env=envFor([],requests);
  await handleTelegramUpdate({message:{text:'/start@RJTtobot wallet',chat:{id:user.id,type:'private'},from:user}},env,
    async(method,data)=>sent.push(method));
  assert.equal(sent[0],'sendRichMessage');
  sent.length=0;
  await handleTelegramUpdate({message:{text:'/start',chat:{id:user.id,type:'private'},from:user}},env,
    async(method,data)=>sent.push(method));
  assert.equal(sent[0],'sendGame');
});
test('private operator diagnostic identifies healthy worker and D1 without exposing secrets',async()=>{
  const requests=[],env=envFor([],requests);
  const report=await diagnoseWallet(env,user.id);
  assert.match(report,/Amoy 80002/);
  assert.match(report,/احراز هویت داخلی/);
  assert.match(report,/کیف پول این حساب شناسایی شد/);
  assert.equal(report.includes(env.WALLET_SERVICE_KEY),false);
  assert.equal(requests.length,3);
});
test('diagnostic detects missing bot connection settings',async()=>{
  const report=await diagnoseWallet({ADMIN_TELEGRAM_USER_ID:'208627'},user.id);
  assert.match(report,/تنظیمات ربات ناقص/);
});
test('diagnostic distinguishes internal unauthorized result from RPC or missing route',async()=>{
  const env={...envFor([],[]),WALLET:{async fetch(url){
    if(url.endsWith('/health'))return new Response(JSON.stringify({chainId:80002}),{status:200});
    return new Response(JSON.stringify({error:'UNAUTHORIZED'}),{status:401});
  }}};
  const output=await diagnoseWallet(env,user.id);
  assert.match(output,/401/);
  assert.match(output,/WALLET_SERVICE_KEY/);
});
test('no diagnostic details are accessible to wrong Telegram identity or group members',async()=>{
  const env=envFor([],[]),out=[];
  await walletDiagnosticCommand({chat:{id:99,type:'private'},from:{id:99}},env,
    async(method,data)=>out.push({method,data}));
  assert.equal(out[0].method,'sendMessage');
  assert.match(out[0].data.text,/مجوز بررسی مدیریتی/);
  assert.match(out[0].data.text,/Telegram User ID شما: 99/);
  out.length=0;
  await walletDiagnosticCommand({chat:{id:-123,type:'supergroup'},from:user},env,
    async(method,data)=>out.push({method,data}));
  assert.equal(out.length,0);
});

test('myid shows verified Telegram identity privately and never exposes group user IDs', async()=>{
  const privateReply=[],groupReply=[];
  const env=envFor([],[]);
  await handleTelegramUpdate({message:{text:'/myid',chat:{id:208627,type:'private'},from:user}},env,
    async(method,data)=>privateReply.push({method,data}));
  assert.equal(privateReply[0].method,'sendMessage');
  assert.match(privateReply[0].data.text,/208627/);
  await handleTelegramUpdate({message:{text:'/myid',chat:{id:-100,type:'supergroup'},from:user}},env,
    async(method,data)=>groupReply.push({method,data}));
  assert.equal(groupReply[0].method,'sendMessage');
  assert.equal(groupReply[0].data.text.includes('208627'),false);
});
test('Telegram /start myid opens identity instead of launching a game',async()=>{
  const outputs=[];
  await handleTelegramUpdate({message:{text:'/start myid',chat:{id:208627,type:'private'},from:user}},envFor([],[]),
    async(method,data)=>outputs.push({method,data}));
  assert.equal(outputs[0].method,'sendMessage');
  assert.match(outputs[0].data.text,/208627/);
  assert.ok(!outputs.some(x=>x.method==='sendGame'));
});
