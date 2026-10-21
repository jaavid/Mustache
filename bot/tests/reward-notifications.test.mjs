import {test} from 'node:test';
import assert from 'node:assert/strict';
import {confirmedRewardText,dispatchConfirmedRewards} from '../src/rewardNotifications.js';
const hash='0x'+'a'.repeat(64);
const data={
  state:'CLAIMED',operationKey:'reward:welcome-100-202610:208627',
  telegramUserId:'208627',amount:'100',source:'genesis',
  batchId:'welcome-100-202610',txHash:hash
};
const config={WALLET_SERVICE_KEY:'test-internal-secret',ADMIN_TELEGRAM_USER_ID:'208627'};

function testEnv(items){
  const operations=[];
  return {operations,env:{...config,WALLET:{
    async fetch(url,options){
      const body=JSON.parse(options.body);
      operations.push({url,method:options.method,body,
        admin:options.headers['x-telegram-user-id']});
      assert.equal(options.method,'POST');
      assert.equal(options.headers['x-wallet-service-key'],config.WALLET_SERVICE_KEY);
      assert.equal(options.headers['x-telegram-user-id'],config.ADMIN_TELEGRAM_USER_ID);
      if(url.endsWith('/claim'))return Response.json(items.shift()||{state:'EMPTY'});
      if(url.endsWith('/ack'))return Response.json({state:body.status});
      throw Error('unknown route');
    }
  }}};
}
test('welcome gift text includes verified test token amount, explorer and private wallet',()=>{
  const text=confirmedRewardText(data);
  assert.match(text,/هدیه آغازین N5/);
  assert.match(text,/100 tNFIVE/);
  assert.match(text,/تأیید شد/);
  assert.match(text,/https:\/\/t.me\/RJTtobot\?start=wallet/);
  assert.match(text,new RegExp(hash));
  assert.match(text,/ارزش مالی واقعی ندارند/);
  assert.doesNotMatch(text,/private.?key/i);
});
test('weekly reward has a distinct title and source, without claiming a real token',()=>{
  const msg=confirmedRewardText({...data,source:'weekly',amount:'15.5'});
  assert.match(msg,/جایزه هفتگی N5/);
  assert.match(msg,/15\.5 tNFIVE/);
  assert.throws(()=>confirmedRewardText({...data,amount:'bad-token'}));
  assert.throws(()=>confirmedRewardText({...data,txHash:'badhash'}));
});
test('only claimed confirmed event triggers one Telegram message and durable SENT ack',async()=>{
  const {env,operations}=testEnv([{...data},{state:'EMPTY'}]);
  const calls=[];
  const result=await dispatchConfirmedRewards(env,async(method,payload)=>{
    calls.push({method,payload});
    return {message_id:444};
  });
  assert.equal(result.sent,1);
  assert.equal(result.failed,0);
  assert.equal(calls.length,1);
  assert.equal(calls[0].method,'sendMessage');
  assert.equal(calls[0].payload.chat_id,208627);
  assert.ok(calls[0].payload.reply_markup.inline_keyboard.flat().some(x=>x.url.includes('start=wallet')));
  assert.deepEqual(operations.map(o=>o.url.split('/').at(-1)),['claim','ack','claim']);
  assert.equal(operations[1].body.status,'SENT');
  assert.equal(operations[1].body.telegramMessageId,444);
  assert.ok(operations.every(o=>o.url.includes('/internal/admin/notifications/')));
});
test('Telegram failure is recorded once; no retry/send flood',async()=>{
  const {env,operations}=testEnv([{...data},{state:'EMPTY'}]);
  let sends=0;
  const result=await dispatchConfirmedRewards(env,async()=>{sends++;throw Error('secret bot token failure')});
  assert.equal(sends,1);
  assert.equal(result.failed,1);
  assert.equal(operations[1].body.status,'FAILED');
  assert.equal(operations[1].body.reason,'SEND_FAILED');
  assert.equal(JSON.stringify(operations).includes('secret bot token failure'),false);
});
test('uncertain ACK stays operator-visible and is never automatically replayed',async()=>{
  const {env,operations}=testEnv([{...data},{state:'EMPTY'}]);
  const api=env.WALLET.fetch.bind(env.WALLET);
  env.WALLET.fetch=async(url,options)=>{
    if(url.endsWith('/ack'))throw Error('ack timeout');
    return api(url,options);
  };
  let sent=0;
  const result=await dispatchConfirmedRewards(env,async()=>{sent++;return {message_id:111};});
  assert.equal(sent,1);
  assert.equal(result.unknown,1);
  assert.equal(operations.length,2);
});
test('no internal admin config means no user messages, and no signing endpoints are invoked',async()=>{
  const actions=[];
  await assert.rejects(dispatchConfirmedRewards({},async()=>actions.push('send')),/REWARD_NOTIFICATIONS_NOT_CONFIGURED/);
  assert.equal(actions.length,0);
});
