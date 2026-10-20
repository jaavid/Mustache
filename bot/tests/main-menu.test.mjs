import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleTelegramUpdate} from '../src/index.js';
import {isPrivateChatOwner, MAIN_BUTTONS, mainReplyKeyboard, parseMainMenuMessage} from '../src/mainMenu.js';

const user={id:208627,first_name:'Javid'};
const privateMessage=text=>({message:{chat:{id:user.id,type:'private'},from:user,text}});
const sendLog=()=>{const calls=[];return {calls,send:async(method,payload)=>calls.push({method,payload})};};

test('main keyboard has exactly three colored persistent reply buttons',()=>{
  const keyboard=mainReplyKeyboard();
  assert.equal(keyboard.is_persistent,true);
  assert.equal(keyboard.one_time_keyboard,false);
  assert.equal(keyboard.resize_keyboard,true);
  assert.equal(keyboard.keyboard.length,1);
  assert.deepEqual(keyboard.keyboard[0].map(b=>b.text),[
    MAIN_BUTTONS.play,MAIN_BUTTONS.wallet,MAIN_BUTTONS.help,
  ]);
  assert.deepEqual(keyboard.keyboard[0].map(b=>b.style),['danger','success','primary']);
  assert.ok(keyboard.keyboard[0].every(b=>!b.url && !b.callback_data));
});

test('/start installs keyboard after game card once, only in private owner chat',async()=>{
  const log=sendLog();
  await handleTelegramUpdate(privateMessage('/start'),{},log.send);
  assert.deepEqual(log.calls.map(x=>x.method),['sendGame','sendMessage']);
  assert.equal(log.calls[1].payload.reply_markup.is_persistent,true);
  log.calls.length=0;
  await handleTelegramUpdate({message:{chat:{id:-50,type:'supergroup'},from:user,text:'/start'}},{},log.send);
  assert.deepEqual(log.calls.map(x=>x.method),['sendGame']);
});

test('all persistent button messages map to existing commands in authenticated private chat',async()=>{
  for(const [text,expected] of [
    [MAIN_BUTTONS.play,'play'],
    [MAIN_BUTTONS.wallet,'wallet'],
    [MAIN_BUTTONS.help,'help'],
  ]){
    assert.equal(parseMainMenuMessage(text),expected);
  }
  for(const text of [MAIN_BUTTONS.wallet+' extra','کیف پول','/wallet','💰 کیف پول\n/withdraw 1 0xaaa']) {
    assert.equal(parseMainMenuMessage(text),null);
  }
  assert.equal(isPrivateChatOwner({chat:{id:208627,type:'private'},from:user}),true);
  assert.equal(isPrivateChatOwner({chat:{id:-1,type:'supergroup'},from:user}),false);
  assert.equal(isPrivateChatOwner({chat:{id:999,type:'private'},from:user}),false);
});

test('game reply button launches the existing Telegram Game API',async()=>{
  const log=sendLog();
  await handleTelegramUpdate(privateMessage(MAIN_BUTTONS.play),{},log.send);
  assert.deepEqual(log.calls.map(x=>x.method),['sendGame']);
  assert.equal(log.calls[0].payload.game_short_name,'mustache');
});

test('help button opens six-command guide and reinstalls persistent keyboard',async()=>{
  const log=sendLog();
  await handleTelegramUpdate(privateMessage(MAIN_BUTTONS.help),{},log.send);
  assert.equal(log.calls.length,1);
  assert.equal(log.calls[0].method,'sendMessage');
  assert.equal(log.calls[0].payload.reply_markup.is_persistent,true);
  assert.match(log.calls[0].payload.text,/\/wallet/);
  assert.deepEqual(log.calls[0].payload.reply_markup.keyboard[0].map(x=>x.style),
    ['danger','success','primary']);
  log.calls.length=0;
  await handleTelegramUpdate(privateMessage('/help'),{},log.send);
  assert.equal(log.calls[0].payload.reply_markup.is_persistent,true);
});

test('group chat help retains old inline buttons and does not install private keyboard',async()=>{
  const log=sendLog();
  await handleTelegramUpdate({message:{chat:{id:-200,type:'supergroup'},from:user,text:'/help'}},{},log.send);
  assert.equal(log.calls.length,1);
  assert.ok(log.calls[0].payload.reply_markup.inline_keyboard);
  assert.equal(log.calls[0].payload.reply_markup.keyboard,undefined);
  log.calls.length=0;
  await handleTelegramUpdate({message:{chat:{id:-200,type:'supergroup'},from:user,text:MAIN_BUTTONS.wallet}},{},log.send);
  assert.equal(log.calls.length,0);
});
