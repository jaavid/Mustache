// Read-only Telegram operations dashboard. Financial mutations remain admin-API only.
const paragraph = text => ({type:'paragraph',text});
const heading = text => ({type:'heading',size:2,text});
const clean = (value, len=85) => String(value??'').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').trim().slice(0,len);
function keyboard() {
  return {inline_keyboard:[
    [{text:'📊 وضعیت سرویس',callback_data:'na:s'}, {text:'💰 خزانه و توزیع‌کننده',callback_data:'na:f'}],
    [{text:'👥 کیف پول‌ها',callback_data:'na:w'}, {text:'🎁 آخرین Batchها',callback_data:'na:b'}],
    [{text:'〰️💼 کیف پول شخصی',callback_data:'nw:w'}]
  ]};
}
function authorized(chat,user,env) {
  return Boolean(env.ADMIN_TELEGRAM_USER_ID) &&
    chat?.type==='private' &&
    Number.isSafeInteger(user?.id) && user.id===chat.id &&
    String(user.id)===String(env.ADMIN_TELEGRAM_USER_ID);
}
async function getOverview(env,userId) {
  if(!env.WALLET_SERVICE_KEY) throw Error('UNCONFIGURED');
  const url=env.WALLET
    ? 'https://wallet.internal/internal/admin/overview'
    : env.WALLET_API_URL?.startsWith('https://')
      ? env.WALLET_API_URL.replace(/\/$/,'')+'/internal/admin/overview':null;
  if(!url) throw Error('UNCONFIGURED');
  const headers={'x-wallet-service-key':env.WALLET_SERVICE_KEY,'x-telegram-user-id':String(userId)};
  const options={headers,signal:AbortSignal.timeout(9000)};
  const response=await (env.WALLET?env.WALLET.fetch(url,options):fetch(url,options));
  if(!response.ok) throw Error('OVERVIEW_UNAVAILABLE');
  return response.json();
}
function details(data,tab='s') {
  const operational=data.distributor||{};
  const treasury=data.treasury||{};
  const enabled=data.transfersEnabled===true?'🟠 روشن':'✅ خاموش';
  const auto=data.autoRewardsEnabled===true?'🟠 روشن':'✅ خاموش';
  const blocks=[heading('〰️🛡️ N5 Admin · Amoy')];
  const lines=['〰️🛡️ پنل مدیریت N5', '🌐 Polygon Amoy (80002)'];
  if(tab==='s') {
    blocks.push(paragraph('📊 وضعیت سرویس (فقط مشاهده)'),
      paragraph('🚦 تراکنش‌ها: '+enabled),
      paragraph('🎁 پاداش خودکار: '+auto),
      paragraph('👥 کیف پول ثبت‌شده: '+data.walletCount),
      paragraph('🧾 وضعیت تراکنش‌ها: '+(data.txStates||[]).map(x=>clean(x.state)+': '+Number(x.count)).join(' · ')));
    lines.push('🚦 تراکنش‌ها: '+enabled,'🎁 پاداش خودکار: '+auto,'👥 کیف پول‌ها: '+data.walletCount);
    lines.push('🧾 '+(data.txStates||[]).map(x=>clean(x.state)+': '+Number(x.count)).join(' · '));
  }
  if(tab==='w') {
    blocks.push(paragraph('👥 تعداد کیف پول‌های ذخیره‌شده: '+data.walletCount),
      paragraph('🔐 کیف پول‌های موجود با ورود مجدد عوض نمی‌شوند.'),
      paragraph('✅ کاربران جدید پس از شروع معتبر بازی خودکار ثبت می‌شوند.'));
    lines.push('👥 کیف پول‌های ذخیره‌شده: '+data.walletCount);
  }
  if(tab==='f') {
    blocks.push(paragraph('💰 خزانه: '+clean(treasury.balance,36)+' '+clean(data.symbol,12)),
      paragraph('⛽ POL خزانه: '+clean(treasury.pol,28)),
      paragraph('🏦 Distributor: '+clean(operational.address||operational.state,44)),
      paragraph('🎁 NFIVE عملیاتی: '+clean(operational.balance,36)),
      paragraph('⛽ POL عملیاتی: '+clean(operational.pol,28)));
    lines.push('💰 خزانه: '+clean(treasury.balance)+' '+clean(data.symbol),
      '⛽ POL خزانه: '+clean(treasury.pol),
      '🏦 Distributor: '+clean(operational.address||operational.state),
      '🎁 موجودی عملیاتی: '+clean(operational.balance),
      '⛽ POL عملیاتی: '+clean(operational.pol));
  }
  if(tab==='b') {
    const batches=Array.isArray(data.batches)?data.batches.slice(0,8):[];
    blocks.push(paragraph('🎁 آخرین Batchهای توزیع آزمایشی'));
    if(batches.length){
      const cell=(text,header=false)=>({text:clean(text,60),align:'right',...(header?{is_header:true}:{})});
      blocks.push({type:'table',is_compact:true,is_bordered:true,is_striped:true,cells:[
        [cell('Batch',true),cell('tNFIVE',true),cell('وضعیت',true)],
        ...batches.map(x=>[cell(x.batch_id),cell(format(x.total_raw,x.decimals)),cell(x.state)])
      ]});
      for(const b of batches)lines.push(clean(b.batch_id)+' · '+format(b.total_raw,b.decimals)+' · '+clean(b.state));
    }else { blocks.push(paragraph('Batch ثبت‌شده‌ای وجود ندارد.'));lines.push('Batch ثبت‌شده‌ای وجود ندارد.'); }
  }
  blocks.push({type:'divider'},paragraph('🔒 این صفحه فقط‌خواندنی است. تأیید یا ارسال توکن از اینجا انجام نمی‌شود.'));
  lines.push('🔒 فقط مشاهده؛ بدون مجوز انتقال.');
  return {rich_message:{blocks,is_rtl:true,skip_entity_detection:true},
    text:lines.join('\n'),reply_markup:keyboard()};
}
function format(value,decimals) {
  const d=Number(decimals);
  if(!Number.isInteger(d)||d<0||d>36||!/^\d+$/.test(String(value)))return '—';
  const str=BigInt(value).toString().padStart(d+1,'0');
  return d===0?str:str.slice(0,-d)+'.'+str.slice(-d).replace(/0+$/,'').replace(/^$/,'0');
}
async function deliver(send,destination,data,isEdit=false) {
  const payload=details(data.data,data.tab);
  try {
    await send(isEdit?'editMessageText':'sendRichMessage',
      {...destination,rich_message:payload.rich_message,reply_markup:payload.reply_markup});
  } catch(e) {
    if(e?.message!=='TELEGRAM_RICH_UNSUPPORTED') throw e;
    await send(isEdit?'editMessageText':'sendMessage',
      {...destination,text:payload.text,reply_markup:payload.reply_markup});
  }
}
export async function adminCommand(message,env,send) {
  if(!authorized(message.chat,message.from,env)) {
    // Avoid revealing account management UI in a group chat.
    if(message.chat?.type==='private') await send('sendMessage',{chat_id:message.chat.id,text:'این حساب مجوز مدیریت N5 را ندارد.'});
    return;
  }
  try{
    const data=await getOverview(env,message.from.id);
    await deliver(send,{chat_id:message.chat.id},{data,tab:'s'});
  }catch{
    await send('sendMessage',{chat_id:message.chat.id,text:'پنل مدیریت در دسترس نیست. تنظیمات دو Worker و ADMIN_TELEGRAM_USER_ID را بررسی کن.'});
  }
}
export async function adminCallback(callback,env,send) {
  const ack=text=>send('answerCallbackQuery',{
    callback_query_id:callback.id,...(text?{text,show_alert:false}:{cache_time:0})
  });
  if(!authorized(callback.message?.chat,callback.from,env))return ack('دسترسی مجاز نیست.');
  const match=/^na:([sfwb])$/.exec(callback.data||'');
  if(!match)return ack('گزینه معتبر نیست.');
  if(!Number.isSafeInteger(callback.message?.message_id))return ack('دوباره /admin را بفرست.');
  try{
    const data=await getOverview(env,callback.from.id);
    await deliver(send,{chat_id:callback.from.id,message_id:callback.message.message_id},{data,tab:match[1]},true);
    return ack();
  }catch(e){
    if(e?.message==='TELEGRAM_MESSAGE_NOT_MODIFIED')return ack();
    return ack('در حال حاضر اطلاعات در دسترس نیست.');
  }
}
