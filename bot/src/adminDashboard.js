// Read-only Telegram operations dashboard. Financial mutations remain admin-API only.
const paragraph = text => ({type:'paragraph',text});
const heading = text => ({type:'heading',size:2,text});
const clean = (value, len=85) => String(value??'').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').trim().slice(0,len);
function keyboard() {
  return {inline_keyboard:[
    [{text:'📊 وضعیت سرویس',callback_data:'na:s'}, {text:'💰 خزانه و توزیع‌کننده',callback_data:'na:f'}],
    [{text:'👥 کیف پول‌ها',callback_data:'na:w'}, {text:'🎁 آخرین Batchها',callback_data:'na:b'}],
    [{text:'📦 وضعیت توزیع و پیام‌ها',callback_data:'na:d'}, {text:'🏅 جایزه هفتگی',callback_data:'na:p'}],
    [{text:'〰️💼 کیف پول شخصی',callback_data:'nw:w'}]
  ]};
}
function authorized(chat,user,env) {
  return Boolean(env.ADMIN_TELEGRAM_USER_ID) &&
    chat?.type==='private' &&
    Number.isSafeInteger(user?.id) && user.id===chat.id &&
    String(user.id)===String(env.ADMIN_TELEGRAM_USER_ID);
}
async function getResource(env,userId,path) {
  if(!env.WALLET_SERVICE_KEY) throw Error('UNCONFIGURED');
  const url=env.WALLET
    ? 'https://wallet.internal'+path
    : env.WALLET_API_URL?.startsWith('https://')
      ? env.WALLET_API_URL.replace(/\/$/,'')+path:null;
  if(!url) throw Error('UNCONFIGURED');
  const headers={'x-wallet-service-key':env.WALLET_SERVICE_KEY,'x-telegram-user-id':String(userId)};
  const options={headers,signal:AbortSignal.timeout(15000)};
  const response=await (env.WALLET?env.WALLET.fetch(url,options):fetch(url,options));
  if(!response.ok) throw Error('OVERVIEW_UNAVAILABLE');
  return response.json();
}
async function getOverview(env,userId) {
  return getResource(env,userId,'/internal/admin/overview');
}
async function getWeeklyPreview(env,userId) {
  return getResource(env,userId,'/internal/admin/weekly/preview');
}
async function getBatch(env,userId,batchId) {
  return getResource(env,userId,'/internal/admin/batches/'+encodeURIComponent(batchId));
}

function details(data,tab='s',preview=null) {
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
  if(tab==='d') {
    blocks.push(paragraph('📦 خلاصه توزیع‌های ثبت‌شده و اعلان‌های تلگرام'));
    lines.push('📦 وضعیت توزیع‌ها');
    if(!Array.isArray(data.progress)||data.progress.length===0) {
      blocks.push(paragraph('هنوز هیچ Batch توزیع ثبت نشده است.'));
      lines.push('هنوز هیچ Batch ثبت نشده است.');
    } else {
      for(const b of data.progress.slice(0,8)){
        const title=clean(b.batch_id,55)+' · '+clean(b.state,20);
        const status='✅ '+Number(b.confirmed||0)+'/'+Number(b.recipients||0)+
          ' · ⏳ '+Number(b.pending||0)+' · ❌ '+Number(b.failed||0);
        const notifications='📩 '+Number(b.notifications_sent||0)+' ارسال موفق'+
          ' · ⚠️ '+Number(b.notifications_failed||0)+' ناموفق'+
          ' · ❔ '+Number(b.notifications_unknown||0)+' نامشخص';
        blocks.push(paragraph(title),paragraph(status),paragraph(notifications));
        lines.push(title,status,notifications);
      }
    }
    blocks.push(paragraph('🔒 پرداخت فقط پس از تأیید مستقل Batch و موجودی عملیاتی انجام می‌شود.'));
  }
  if(tab==='p') {
    blocks.push(paragraph('🏅 آخرین هفته کامل‌شده به وقت تهران (پیش‌نمایش بدون انتقال)'));
    if(preview?.state==='PREVIEW') {
      blocks.push(paragraph('💰 بودجه پیش‌فرض: '+clean(preview.pool)+' tNFIVE'),
        paragraph('👥 بازیکنان واجد شرایط: '+Number(preview.eligible)),
        paragraph('📐 ۴۰٪ سهم مساوی + ۶۰٪ سهم رتبه‌ای'));
      lines.push('💰 بودجه پیش‌فرض: '+clean(preview.pool)+' tNFIVE',
        '👥 بازیکنان واجد شرایط: '+Number(preview.eligible));
      const winners=preview.winners.slice(0,10);
      const cell=(text,header=false)=>({text:clean(text,45),align:'right',
        ...(header?{is_header:true}:{})});
      blocks.push({type:'table',is_compact:true,is_bordered:false,is_striped:true,cells:[
        [cell('رتبه',true),cell('ID',true),cell('tNFIVE',true)],
        ...winners.map(w=>[cell(w.rank),cell(w.telegramUserId),cell(w.amount)]),
      ]});
      for(const item of winners)lines.push(item.rank+' · '+item.telegramUserId+' · '+item.amount);
    } else if(preview?.state==='EMPTY') {
      blocks.push(paragraph('در هفته تکمیل‌شده بازیکن واجد شرایط پیدا نشد.'));
    } else {
      blocks.push(paragraph('پیش‌نمایش هفته در دسترس نیست؛ RPC و دیتابیس امتیازها را بررسی کن.'));
    }
    blocks.push(paragraph('⚠️ این پیش‌نمایش، تراکنش یا تأیید Batch انجام نمی‌دهد.'));
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
  const markup=keyboard();
  if(tab==='b'&&Array.isArray(data.batches)) {
    for(const batch of data.batches.slice(0,6)) {
      const id=String(batch.batch_id||'');
      if(/^[a-zA-Z0-9_-]{3,50}$/.test(id))
        markup.inline_keyboard.push([{text:'🔎 '+id,callback_data:'na:i:'+id+':0'}]);
    }
  }
  return {rich_message:{blocks,is_rtl:true,skip_entity_detection:true},
    text:lines.join('\n'),reply_markup:markup};
}
function format(value,decimals) {
  const d=Number(decimals);
  if(!Number.isInteger(d)||d<0||d>36||!/^\d+$/.test(String(value)))return '—';
  const str=BigInt(value).toString().padStart(d+1,'0');
  return d===0?str:str.slice(0,-d)+'.'+str.slice(-d).replace(/0+$/,'').replace(/^$/,'0');
}
async function deliver(send,destination,data,isEdit=false) {
  const payload=details(data.data,data.tab,data.preview||null);
  try {
    await send(isEdit?'editMessageText':'sendRichMessage',
      {...destination,rich_message:payload.rich_message,reply_markup:payload.reply_markup});
  } catch(e) {
    if(e?.message!=='TELEGRAM_RICH_UNSUPPORTED') throw e;
    await send(isEdit?'editMessageText':'sendMessage',
      {...destination,text:payload.text,reply_markup:payload.reply_markup});
  }
}
function batchPage(data,page=0) {
  const batch=data.batch||{},items=Array.isArray(data.recipients)?data.recipients:[];
  const count=items.length,start=page*5,selected=items.slice(start,start+5);
  const title='〰️🎁 Batch '+clean(batch.batch_id||'?',55);
  const blocks=[heading(title),
    paragraph('وضعیت: '+clean(batch.state)+' · '+count+' دریافت‌کننده'),
  ];
  const lines=[title,'وضعیت: '+clean(batch.state)+' · '+count+' دریافت‌کننده'];
  for(const r of selected){
    const who=clean(r.displayName||r.telegramUserId,48);
    const state='⛓ '+clean(r.transactionState,30)+' · 📩 '+clean(r.notificationState,30);
    blocks.push(paragraph('👤 '+who+' · '+clean(r.amount,40)+' tNFIVE'),paragraph(state));
    lines.push('👤 '+who+' · '+r.amount+' tNFIVE',state);
  }
  const keyboard={inline_keyboard:[]};
  const change=[];
  if(page>0)change.push({text:'◀️ قبلی',callback_data:'na:i:'+batch.batch_id+':'+(page-1)});
  if(start+5<count)change.push({text:'بعدی ▶️',callback_data:'na:i:'+batch.batch_id+':'+(page+1)});
  if(change.length)keyboard.inline_keyboard.push(change);
  keyboard.inline_keyboard.push([{text:'↩️ لیست Batchها',callback_data:'na:b'}]);
  return {rich_message:{blocks,is_rtl:true,skip_entity_detection:true},text:lines.join('\n'),reply_markup:keyboard};
}

async function deliverBatch(send,destination,data,page,isEdit=true) {
  const payload=batchPage(data,page);
  try {
    await send(isEdit?'editMessageText':'sendRichMessage',
      {...destination,rich_message:payload.rich_message,reply_markup:payload.reply_markup});
  }catch(e) {
    if(e?.message!=='TELEGRAM_RICH_UNSUPPORTED')throw e;
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
  const match=/^na:([sfwbdp])$/.exec(callback.data||'');
  const batchMatch=/^na:i:([a-zA-Z0-9_-]{3,50}):(0|[1-9]|1[0-9])$/.exec(callback.data||'');
  if(!match&&!batchMatch)return ack('گزینه معتبر نیست.');
  if(!Number.isSafeInteger(callback.message?.message_id))return ack('دوباره /admin را بفرست.');
  try{
    if(batchMatch) {
      const result=await getBatch(env,callback.from.id,batchMatch[1]);
      await deliverBatch(send,{chat_id:callback.from.id,message_id:callback.message.message_id},
        result,Number(batchMatch[2]),true);
      return ack();
    }
    const [data,preview]=await Promise.all([
      getOverview(env,callback.from.id),
      match[1]==='p' ? getWeeklyPreview(env,callback.from.id).catch(()=>null) : Promise.resolve(null),
    ]);
    await deliver(send,{chat_id:callback.from.id,message_id:callback.message.message_id},
      {data,tab:match[1],preview},true);
    return ack();
  }catch(e){
    if(e?.message==='TELEGRAM_MESSAGE_NOT_MODIFIED')return ack();
    return ack('در حال حاضر اطلاعات در دسترس نیست.');
  }
}
