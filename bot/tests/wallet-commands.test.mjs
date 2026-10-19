import {test} from 'node:test';
import assert from 'node:assert/strict';
import { parseWithdraw, walletCommand, confirmWalletCallback } from '../src/walletCommands.js';
import { parseGameCommand } from '../src/index.js';

test('wallet command parser restricts bots and withdrawal syntax',()=>{
  assert.equal(parseGameCommand('/wallet@RJTtobot'),'wallet');
  assert.equal(parseGameCommand('/withdraw@anotherbot'),null);
  assert.deepEqual(parseWithdraw('/withdraw 25 0x'+'1'.repeat(40)),{amount:'25',destination:'0x'+'1'.repeat(40)});
  assert.equal(parseWithdraw('/withdraw 25 banana'),null);
  assert.equal(parseWithdraw('/withdraw -1 0x'+'1'.repeat(40)),null);
  assert.equal(parseWithdraw('/withdraw 25 0x'+'1'.repeat(40)+' extra'),null);
});
test('wallet command never invokes wallet backend for group chats',async()=>{
  const calls=[];
  const env={WALLET_SERVICE_KEY:'secret',WALLET:{fetch(){throw new Error('must not call')}}};
  await walletCommand({text:'/wallet',chat:{id:-100,type:'supergroup'},from:{id:123}},'wallet',env,async(method,data)=>calls.push([method,data]));
  assert.equal(calls.length,1);
  assert.match(calls[0][1].text,/پیام خصوصی/);
});
test('verified Telegram user ID is forwarded; returned wallet data displayed in DM only',async()=>{
  const requests=[],messages=[];
  const env={WALLET_SERVICE_KEY:'secret',WALLET:{async fetch(url,opts){
    requests.push({url,opts});
    return new Response(JSON.stringify({address:'0x'+'1'.repeat(40),balance:'42',symbol:'tNFIVE',pol:'0.0',explorer:'https://amoy.polygonscan.com/address/test'}),{status:200});
  }}};
  await walletCommand({text:'/wallet',chat:{id:123,type:'private'},from:{id:123}},'wallet',env,async(method,data)=>messages.push({method,data}));
  assert.equal(requests[0].opts.headers['x-telegram-user-id'],'123');
  assert.match(messages[0].data.text,/42 tNFIVE/);
});
test('callback owner is taken from authenticated callback.from',async()=>{
  const req=[];
  const env={WALLET_SERVICE_KEY:'secret',WALLET:{async fetch(url,opts){req.push(opts.headers['x-telegram-user-id']);return new Response(JSON.stringify({state:'READY'}),{status:200})}}};
  const sent=[];
  await confirmWalletCallback({id:'callback',data:'wd:'+'a'.repeat(8)+'-'+'a'.repeat(4)+'-'+'a'.repeat(4)+'-'+'a'.repeat(4)+'-'+'a'.repeat(12),from:{id:42},message:{chat:{id:42,type:'private'}}},env,async(method,data)=>sent.push(method));
  assert.deepEqual(req,['42']);
  assert.ok(sent.includes('answerCallbackQuery'));
});
