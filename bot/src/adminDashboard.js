// Authenticated N5 admin: read-only reports plus two-step, backend-guarded testnet reward dispatch.
const paragraph = text => ({type:'paragraph',text});
const heading = text => ({type:'heading',size:2,text});
const clean = (value, len=85) => String(value??'').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').trim().slice(0,len);
/** Never round with floating point: D1 balances and ERC-20 amounts can be bigint-sized. */
export function decimalLabel(value,precision=2) {
  const match=/^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(String(value??''));
  if(!match||!Number.isInteger(precision)||precision<0||precision>6)return '—';
  const frac=(match[2]||'');
  const scale=10n**BigInt(frac.length);
  const p=10n**BigInt(precision);
  const count=BigInt(match[1])*p+(BigInt(frac||'0')*p+scale/2n)/scale;
  const whole=(count/p).toLocaleString('en-US');
  const tail=precision?(count%p).toString().padStart(precision,'0').replace(/0+$/,''):'';
  return whole+(tail?'.'+tail:'');
}
export function compactAddress(value) {
  const v=String(value||'');
  return /^0x[0-9a-f]{40}$/i.test(v) ? v.slice(0,8)+'…'+v.slice(-6) : clean(v,24);
}
const compactStatus=state=>({
  PLANNED:'آماده‌سازی',APPROVED:'تأییدشده',COMPLETE:'تکمیل',REVIEW_REQUIRED:'نیازمند بررسی',
  SIGNED:'امضاشده',SUBMITTED:'در انتظار تأیید',CONFIRMED:'موفق',
  PILOT:'در حال تست یک نفر',PILOT_OK:'تست موفق',ALL:'در حال توزیع',PAUSED:'متوقف',
  NOT_PREPARED:'آماده نشده',SENT:'اعلان ارسال شد',FAILED:'خطا'
})[state]||clean(state,25);
function keyboard() {
  return {inline_keyboard:[
    [{text:'📊 وضعیت سرویس',callback_data:'na:s'}, {text:'💰 خزانه و توزیع‌کننده',callback_data:'na:f'}],
    [{text:'👥 کیف پول‌ها',callback_data:'na:w'}, {text:'🎁 آخرین Batchها',callback_data:'na:b'}],
    [{text:'📦 وضعیت توزیع و پیام‌ها',callback_data:'na:d'}, {text:'🏅 جایزه هفتگی',callback_data:'na:p'}],
    [{text:'🎯 مدیریت پرداخت‌های تستی',callback_data:'na:o'}],
    [{text:'〰️💼 کیف پول شخصی',callback_data:'nw:w'}]
  ]};
}
function authorized(chat,user,env) {
  return Boolean(env.ADMIN_TELEGRAM_USER_ID) &&
    chat?.type==='private' &&
    Number.isSafeInteger(user?.id) && user.id===chat.id &&
    String(user.id)===String(env.ADMIN_TELEGRAM_USER_ID);
}
async function getResource(env,userId,path,body=undefined) {
  if(!env.WALLET_SERVICE_KEY) throw Error('UNCONFIGURED');
  const url=env.WALLET
    ? 'https://wallet.internal'+path
    : env.WALLET_API_URL?.startsWith('https://')
      ? env.WALLET_API_URL.replace(/\/$/,'')+path:null;
  if(!url) throw Error('UNCONFIGURED');
  const headers={'x-wallet-service-key':env.WALLET_SERVICE_KEY,'x-telegram-user-id':String(userId)};
  const options={headers:{...headers,...(body===undefined?{}:{'content-type':'application/json'})},
    ...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),
    signal:AbortSignal.timeout(15000)};
  const response=await (env.WALLET?env.WALLET.fetch(url,options):fetch(url,options));
  if(!response.ok) {
    let reason='OVERVIEW_UNAVAILABLE';
    try{const out=await response.json();if(/^[A-Z][A-Z0-9_]{1,65}$/.test(out?.error||''))reason=out.error;}catch{}
    throw Error(reason);
  }
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
async function operator(env,userId,body) {
  return getResource(env,userId,'/internal/admin/operator',body);
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
    blocks.push(paragraph('💰 خزانه: '+decimalLabel(treasury.balance)+' '+clean(data.symbol,12)),
      paragraph('⛽ POL خزانه: '+decimalLabel(treasury.pol,4)),
      paragraph('🏦 Distributor: '+compactAddress(operational.address||operational.state)),
      paragraph('🎁 NFIVE عملیاتی: '+decimalLabel(operational.balance)),
      paragraph('⛽ POL عملیاتی: '+decimalLabel(operational.pol,4)));
    lines.push('💰 خزانه: '+decimalLabel(treasury.balance)+' '+clean(data.symbol),
      '⛽ POL خزانه: '+decimalLabel(treasury.pol,4),
      '🏦 Distributor: '+compactAddress(operational.address||operational.state),
      '🎁 موجودی عملیاتی: '+decimalLabel(operational.balance),
      '⛽ POL عملیاتی: '+decimalLabel(operational.pol,4));
  }
  if(tab==='d') {
    blocks.push(paragraph('📦 خلاصه توزیع‌های ثبت‌شده و اعلان‌های تلگرام'),
      paragraph('🎁 هدیه اولیه: ۱۰۰ tNFIVE × '+Number(data.walletCount||0)+' کیف پول = '+(100*Number(data.walletCount||0))+' tNFIVE (در صورت آماده‌بودن تمام کیف پول‌ها)'));
    lines.push('📦 وضعیت توزیع‌ها');
    if(!Array.isArray(data.progress)||data.progress.length===0) {
      blocks.push(paragraph('هنوز هیچ Batch توزیع ثبت نشده است.'));
      lines.push('هنوز هیچ Batch ثبت نشده است.');
    } else {
      for(const b of data.progress.slice(0,8)){
        const title=clean(b.batch_id,55)+' · '+compactStatus(b.state);
        const status='✅ '+Number(b.confirmed||0)+'/'+Number(b.recipients||0)+
          ' · ⏳ '+Number(b.pending||0)+' · ⏸ '+Number(b.not_sent||0)+' · ❌ '+Number(b.failed||0);
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
      blocks.push(paragraph('💰 بودجه مصوب: '+decimalLabel(preview.pool)+' tNFIVE'),
        paragraph('👥 بازیکنان واجد شرایط: '+Number(preview.eligible)),
        paragraph('📐 ۴۰٪ سهم مساوی + ۶۰٪ سهم رتبه‌ای'));
      lines.push('💰 بودجه مصوب: '+decimalLabel(preview.pool)+' tNFIVE',
        '👥 بازیکنان واجد شرایط: '+Number(preview.eligible));
      const winners=preview.winners.slice(0,10);
      const cell=(text,header=false)=>({text:clean(text,45),align:'right',
        ...(header?{is_header:true}:{})});
      blocks.push({type:'table',is_compact:true,is_bordered:false,is_striped:true,cells:[
        [cell('رتبه',true),cell('ID',true),cell('tNFIVE',true)],
        ...winners.map(w=>[cell(w.rank),cell(w.telegramUserId),cell(decimalLabel(w.amount))]),
      ]});
      for(const item of winners)lines.push(item.rank+' · '+item.telegramUserId+' · '+decimalLabel(item.amount));
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
        ...batches.map(x=>[cell(x.batch_id),cell(format(x.total_raw,x.decimals)),cell(compactStatus(x.state))])
      ]});
      for(const b of batches)lines.push(clean(b.batch_id)+' · '+format(b.total_raw,b.decimals)+' · '+compactStatus(b.state));
    }else { blocks.push(paragraph('Batch ثبت‌شده‌ای وجود ندارد.'));lines.push('Batch ثبت‌شده‌ای وجود ندارد.'); }
  }
  blocks.push({type:'divider'},paragraph('🔒 گزارش فقط‌خواندنی است؛ پرداخت فقط از «مدیریت پرداخت‌های تستی» و با تأیید دومرحله‌ای انجام می‌شود.'));
  lines.push('🔒 نمایش بدون انتقال؛ برای پرداخت از مدیریت توزیع استفاده کن.');
  const markup=keyboard();
  if(tab==='f'&&/^0x[0-9a-f]{40}$/i.test(operational.address||'')) {
    markup.inline_keyboard.unshift([{text:'📋 کپی آدرس کامل Distributor',
      copy_text:{text:operational.address}}]);
  }
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
  return decimalLabel(d===0?str:str.slice(0,-d)+'.'+str.slice(-d).replace(/0+$/,'').replace(/^$/,'0'));
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
    const identity='🆔 '+clean(r.telegramUserId,24)+' · '+compactAddress(r.address);
    const issue=r.notificationError?'⚠️ اعلان: '+clean(r.notificationError,38):null;
    blocks.push(paragraph('👤 '+who+' · '+decimalLabel(r.amount)+' tNFIVE'),
      paragraph(identity),paragraph(state));
    if(issue)blocks.push(paragraph(issue));
    lines.push('👤 '+who+' · '+decimalLabel(r.amount)+' tNFIVE',identity,state);
    if(issue)lines.push(issue);
  }
  const keyboard={inline_keyboard:[]};
  // Telegram button text is short; explorer links only for verified tx hashes.
  for(const r of selected) {
    if(typeof r.txHash==='string'&&/^0x[a-f0-9]{64}$/i.test(r.txHash))
      keyboard.inline_keyboard.push([{
        text:'🔎 '+clean(r.displayName||r.telegramUserId,20)+' · رسید',
        url:'https://amoy.polygonscan.com/tx/'+r.txHash,
      }]);
  }
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

function payoutKeyboard(kind='welcome',step='select',state=null,run=null) {
  const kindCode=kind==='weekly'?'y':'w';
  const button=(text,code)=>({text,callback_data:code});
  if(step==='select')return {inline_keyboard:[
    [button('🎁 هدیه ۱۰۰تایی','na:op:w'),button('🏆 جایزه هفتگی','na:op:y')],
    [button('🔄 بررسی دوباره','na:o'),button('↩️ پنل ادمین','na:s')],
  ]};
  const keyboard=[];
  if(state==='NOT_PREPARED'||state==='PLANNED')
    keyboard.push([button('📋 آماده‌سازی بدون ارسال','na:pr:'+kindCode)]);
  if(!run && state!=='NOT_PREPARED' && state!=='LEGACY_NEEDS_CORRECTION')
    keyboard.push([button('🧪 تست یک تراکنش','na:tk:'+kindCode+':P')]);
  if(run?.phase==='PILOT_OK')
    keyboard.push([button('🚀 توزیع باقی دریافت‌کنندگان','na:tk:'+kindCode+':A')]);
  if(run?.phase==='PILOT'||run?.phase==='ALL')
    keyboard.push([button('⏸ توقف انتقال‌های بعدی','na:stop:'+kindCode)]);
  keyboard.push([button('🔄 دریافت آخرین وضعیت','na:op:'+kindCode)]);
  keyboard.push([button('↩️ مدیریت توزیع','na:o')]);
  return {inline_keyboard:keyboard};
}

function payoutCard(data,kind=null) {
  const overview=data?.overview||data||{};
  const run=(overview.runs||[]).find(x=>x.batch_id===data?.batchId);
  const chosen=kind==='weekly'?'🏆 جایزه هفتگی':'🎁 هدیه اولیه';
  const rows=kind?[
    '〰️🛡️ '+chosen,
    '📦 Batch: '+clean(data.batchId||'—',70),
    '📊 وضعیت: '+compactStatus(data.state),
    '💰 بودجه: '+decimalLabel(data.total)+' tNFIVE',
  ]:[
    '〰️🛡️ مدیریت توزیع N5 · Polygon Amoy',
    '🧾 کیف پول‌ها: '+(overview.wallets??'—'),
    '🎁 بودجه هدیه: ۲٬۰۰۰ tNFIVE',
    '🏆 بودجه هفتگی: '+decimalLabel(overview.approvedWeeklyPool||'10000')+' tNFIVE',
  ];
  rows.push(
    '🏦 Distributor: '+compactAddress(overview.signer),
    '💰 موجودی: '+decimalLabel(overview.availableTokens)+' tNFIVE',
    '⛽ POL: '+decimalLabel(overview.availablePol,4),
    '🛡 حالت کنترل‌شده: '+(overview.manualOnly?'فعال':'غیرفعال'),
    '🚦 مجوز ارسال: '+(overview.transfersEnabled?'فعال':'خاموش'),
    '🔄 پاداش خودکار: '+(overview.autoRewardsEnabled?'فعال':'خاموش'),
  );
  if(!kind&&overview.legacy)
    rows.push('🧾 genesis-0: '+decimalLabel(overview.legacy.total)+
      ' · '+compactStatus(overview.legacy.state)+
      (overview.legacy.canConvert&&!overview.legacy.alreadyFixed?' · قابل اصلاح ایمن به ۲٬۰۰۰':''));
  if(kind==='welcome'&&data.legacyNeedsCorrection)
    rows.push('⚠️ Batch قدیمی ۱۰٬۰۰۰تایی بدون تراکنش، با دکمه آماده‌سازی به ۲۰ × ۱۰۰ اصلاح و ثبت حسابرسی می‌شود.');
  if(kind==='weekly')rows.push('👥 بازیکنان واجد شرایط: '+(data.eligible??'—'),
    '📐 ۴۰٪ برابر + ۶۰٪ براساس رتبه (هفته کامل‌شده)');
  if(run)rows.push('📡 اجرای فعلی: '+compactStatus(run.phase),
    '👤 تست: '+clean(run.pilot_user_id));
  rows.push('⚠️ تست یک‌نفره و اجرای بقیه، هرکدام تأیید جداگانه دارند.');
  return {
    text:rows.join('\n'),
    rich_message:{blocks:[
      heading(rows[0]),...rows.slice(1).map(paragraph)
    ],is_rtl:true,skip_entity_detection:true},
    reply_markup:payoutKeyboard(kind||'welcome',kind?'detail':'select',
      data?.legacyNeedsCorrection?'LEGACY_NEEDS_CORRECTION':data?.state,run),
  };
}

function confirmPayoutCard(ticket) {
  const type=ticket.stage==='PILOT'?'تست فقط یک نفر':'ارسال به همه افراد باقیمانده';
  const lines=[
    '〰️⚠️ تأیید نهایی انتقال واقعی روی Polygon Amoy',
    '📦 '+clean(ticket.batchId,70),
    '🎯 '+type,
    '👥 در این Batch: '+Number(ticket.recipients)+' نفر',
    '💰 مبلغ باقی‌مانده Batch: '+decimalLabel(ticket.budget)+' tNFIVE',
    '⛽ حداقل ذخیره برآوردی: '+decimalLabel(ticket.estimatedGasPol,4)+' POL',
    '⏰ این مجوز فقط ۵ دقیقه معتبر است و فقط یک بار استفاده می‌شود.',
    '⚠️ این دکمه تراکنش تستی واقعی را وارد صف امضا می‌کند.',
  ];
  return {
    text:lines.join('\n'),
    rich_message:{blocks:[heading(lines[0]),...lines.slice(1).map(paragraph)],
      is_rtl:true,skip_entity_detection:true},
    reply_markup:{inline_keyboard:[
      [{text:'✅ تأیید نهایی '+type,callback_data:'na:go:'+ticket.ticket}],
      [{text:'❎ انصراف',callback_data:'na:o'}],
    ]},
  };
}

async function deliverOperator(send,dest,view){
  try {
    await send('editMessageText',{...dest,rich_message:view.rich_message,
      reply_markup:view.reply_markup});
  }catch(e){
    if(e?.message!=='TELEGRAM_RICH_UNSUPPORTED')throw e;
    await send('editMessageText',{...dest,text:view.text,reply_markup:view.reply_markup});
  }
}

const operatorErrors={
  TRANSFERS_DISABLED:'ارسال در Wallet Worker هنوز غیرفعال است. فقط پس از Preflight، TRANSFERS_ENABLED را با تنظیمات امن روشن کن.',
  MANUAL_MODE_REQUIRED:'MANUAL_REWARDS_ONLY باید true باشد؛ دیپلوی Wallet را بررسی کن.',
  AUTOMATIC_REWARDS_MUST_BE_DISABLED:'AUTO_REWARDS_ENABLED باید false بماند.',
  LEGACY_GENESIS_REVIEW_REQUIRED:'Batch قدیمی قبلاً امضا/پرداخت شده یا با وضعیت فعلی سازگار نیست. بازبینی دستی لازم است.',
  WELCOME_WALLET_COUNT_OUT_OF_RANGE:'برای آماده‌سازی هدیه اولیه باید دقیقاً ۲۰ کیف پول اولیه قابل تأیید باشد.',
  DISTRIBUTOR_LOW_BALANCE:'موجودی tNFIVE توزیع‌کننده کافی نیست.',
  DISTRIBUTOR_LOW_GAS:'POL عملیاتی برای بودجه کارمزد برآوردشده کافی نیست.',
  PILOT_NOT_CONFIRMED:'ابتدا منتظر تأیید آن‌چین تراکنش آزمایشی بمان.',
  PILOT_ALREADY_ATTEMPTED:'تراکنش آزمایشی قبلاً شروع شده؛ وضعیت Batch را بررسی کن.',
  ANOTHER_BATCH_RUNNING:'یک Batch دیگر در حال توزیع است؛ منتظر اتمام یا توقف آن بمان.',
  OPERATOR_TICKET_EXPIRED:'مجوز تأیید منقضی شده؛ دکمه تست/توزیع را دوباره بزن.',
  OPERATOR_TICKET_USED:'این تأیید قبلاً استفاده شده است؛ وضعیت Batch را تازه‌سازی کن.',
  BATCH_NOT_STARTABLE:'Batch هنوز آماده یا تأییدپذیر نیست.',
  WEEKLY_MISSING_WALLETS:'برای همه برندگان هفته کیف پول وجود ندارد؛ ارسال متوقف شد.',
  OPERATION_FAILED:'یک بررسی زیرساختی ناموفق بود؛ گزارش Wallet Worker را بررسی کن.',
};

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
  const choice=/^na:op:([wy])$/.exec(callback.data||'');
  const prep=/^na:pr:([wy])$/.exec(callback.data||'');
  const ticket=/^na:tk:([wy]):([PA])$/.exec(callback.data||'');
  const stop=/^na:stop:([wy])$/.exec(callback.data||'');
  const confirm=/^na:go:([a-f0-9-]{36})$/i.exec(callback.data||'');
  const main=(callback.data==='na:o');
  const match=/^na:([sfwbdp])$/.exec(callback.data||'');
  const batchMatch=/^na:i:([a-zA-Z0-9_-]{3,50}):(0|[1-9]|1[0-9])$/.exec(callback.data||'');
  if(!match&&!batchMatch&&!choice&&!prep&&!ticket&&!stop&&!confirm&&!main)return ack('گزینه معتبر نیست.');
  if(!Number.isSafeInteger(callback.message?.message_id))return ack('دوباره /admin را بفرست.');
  try{
    if(main||choice||prep||ticket||stop||confirm){
      const dest={chat_id:callback.from.id,message_id:callback.message.message_id};
      const kindCode=choice?.[1]||prep?.[1]||ticket?.[1]||stop?.[1];
      const kind=kindCode==='y'?'weekly':'welcome';
      if(main){
        await deliverOperator(send,dest,payoutCard(await operator(env,callback.from.id,{action:'status'})));
      }else if(confirm){
        const result=await operator(env,callback.from.id,{action:'confirm',ticket:confirm[1]});
        const text='✅ Batch '+clean(result.batchId)+' در وضعیت '+compactStatus(result.phase)+
          ' قرار گرفت.\n'+'تراکنش‌ها به ترتیب اجرا می‌شوند. برای دیدن تأییدهای شبکه و اعلان‌ها روی «وضعیت توزیع» بزن.';
        await deliverOperator(send,dest,{
          text,rich_message:{blocks:[heading('〰️✅ شروع کنترل‌شده'),paragraph(text)],
            is_rtl:true,skip_entity_detection:true},
          reply_markup:{inline_keyboard:[
            [{text:'📦 وضعیت و اعلان‌ها',callback_data:'na:d'}],
            [{text:'🎯 بازگشت به مدیریت',callback_data:'na:o'}],
          ]},
        });
      }else if(ticket){
        const result=await operator(env,callback.from.id,{
          action:'ticket',kind,stage:ticket[2]==='P'?'PILOT':'ALL'
        });
        await deliverOperator(send,dest,confirmPayoutCard(result));
      }else{
        if(stop){
          const result=await operator(env,callback.from.id,{action:'pause',kind});
          const text=result.phase==='PAUSED'
            ?'⏸ انتقال‌های جدید Batch '+clean(result.batchId)+' متوقف شدند.\nتراکنش‌هایی که قبلاً ارسال شده‌اند قابل لغو نیستند؛ وضعیت را بررسی کن.'
            :'در حال حاضر Batch فعالی برای توقف وجود ندارد.';
          await deliverOperator(send,dest,{
            text,rich_message:{blocks:[heading('〰️⏸ کنترل توزیع'),paragraph(text)],
              is_rtl:true,skip_entity_detection:true},
            reply_markup:{inline_keyboard:[
              [{text:'📦 پیگیری تراکنش‌ها',callback_data:'na:d'}],
              [{text:'↩️ مدیریت',callback_data:'na:o'}],
            ]},
          });
        }else{
          if(prep)await operator(env,callback.from.id,{action:'prepare',kind});
          const view=await operator(env,callback.from.id,{action:'preview',kind});
          await deliverOperator(send,dest,payoutCard(view,kind));
        }
      }
      return ack();
    }
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
    const message=operatorErrors[e?.message];
    if(message)return ack(message);
    return ack('عملیات انجام نشد؛ اتصال و وضعیت Batch را بررسی کن.');
  }
}
