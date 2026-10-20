/**
 * Read-only private bot-side diagnostics. Do not send tokens, keys, admin
 * credentials, Telegram sessions, raw headers, or runtime errors to chat.
 */
function isOwner(message,env) {
  const chat=message?.chat,from=message?.from;
  return chat?.type==='private' && Number.isSafeInteger(from?.id) &&
    chat.id===from.id && Boolean(env.ADMIN_TELEGRAM_USER_ID) &&
    String(from.id)===String(env.ADMIN_TELEGRAM_USER_ID);
}
function walletUrl(env,path) {
  if(env.WALLET) return 'https://wallet.internal'+path;
  if(typeof env.WALLET_API_URL !== 'string') return null;
  try {
    const u=new URL(env.WALLET_API_URL);
    if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash) return null;
    return u.origin+u.pathname.replace(/\/$/,'')+path;
  }catch{return null;}
}
function statusNote(status) {
  if(status===401) return 'احراز هویت بین دو Worker رد شد. WALLET_SERVICE_KEY را در هر دو Worker بررسی کن.';
  if(status===403) return 'دسترسی رد شد؛ مقدارهای دسترسی داخلی را بررسی کن.';
  if(status===404) return 'مسیر Wallet پیدا نشد. WALLET_API_URL یا نسخه Worker را بررسی کن.';
  if(status===503) return 'Wallet پاسخ داد ولی بک‌اند یا RPC آن آماده نیست.';
  if(status>=500) return 'خطای سرویس Wallet؛ لاگ Worker را بررسی کن.';
  return 'پاسخ غیرمنتظره از سرویس Wallet.';
}
async function call(env,url,opts) {
  try {
    const config={...opts,signal:AbortSignal.timeout(6500)};
    const response=await (env.WALLET ? env.WALLET.fetch(url,config) : fetch(url,config));
    let body=null;
    if(response.ok){
      try{body=await response.json();}catch{}
    }
    return {status:response.status,body};
  }catch{return {status:null,body:null};}
}
export async function diagnoseWallet(env,userId) {
  const lines=['〰️🛠 بررسی اتصال N5 Wallet','', 'این گزارش فقط‌خواندنی است؛ هیچ کلیدی نمایش داده نمی‌شود.'];
  const hasKey=typeof env.WALLET_SERVICE_KEY==='string'&&env.WALLET_SERVICE_KEY.length>0;
  const base=walletUrl(env,'/health');
  const link=env.WALLET?'Cloudflare Service Binding':base ? 'HTTPS Worker URL' : 'تنظیم نشده';
  lines.push('🔗 مسیر اتصال: '+link,'🔐 Service Key: '+(hasKey?'ثبت شده':'ثبت نشده'));
  if(!base || !hasKey){
    lines.push('','⛔ تنظیمات ربات ناقص است. در n5-mustache-rjttobot باید WALLET_API_URL (در صورت نبود Service Binding) و WALLET_SERVICE_KEY تنظیم باشند.');
    return lines.join('\n');
  }
  const health=await call(env,base,{method:'GET'});
  if(health.status===200 && health.body?.chainId===80002){
    lines.push('✅ /health — Worker فعال · Amoy 80002');
    lines.push('🚦 Transfers: '+(health.body.transfersEnabled?'روشن':'خاموش'),
      '🎁 Auto Rewards: '+(health.body.autoRewardsEnabled?'روشن':'خاموش'));
  } else {
    lines.push('❌ /health — '+(health.status ?? 'عدم اتصال'),
      '↳ '+(health.status===null?'درخواست HTTP به Wallet نرسید یا Timeout شد.':statusNote(health.status)));
    return lines.join('\n');
  }
  const history=await call(env,walletUrl(env,'/internal/history'),{
    method:'GET',headers:{'x-wallet-service-key':env.WALLET_SERVICE_KEY,
      'x-telegram-user-id':String(userId)}
  });
  if(history.status===200 && Array.isArray(history.body?.rewards)){
    lines.push('✅ احراز هویت داخلی و اتصال D1 — درست است.');
  }else{
    lines.push('❌ API داخلی — '+(history.status ?? 'عدم اتصال'),
      '↳ '+(history.status===null?'Timeout یا مشکل ارتباط Workerها.':statusNote(history.status)));
    return lines.join('\n');
  }
  const wallet=await call(env,walletUrl(env,'/internal/wallet'),{
    method:'GET',headers:{'x-wallet-service-key':env.WALLET_SERVICE_KEY,
      'x-telegram-user-id':String(userId)}
  });
  if(wallet.status===200 && typeof wallet.body?.address==='string'){
    lines.push('✅ /wallet — کیف پول این حساب شناسایی شد.');
  }else if(wallet.status===200 && wallet.body?.error==='WALLET_NOT_FOUND'){
    lines.push('⚠️ برای این حساب هنوز کیف پول ثبت نشده. Worker جدید Wallet را دیپلوی کن و /wallet را دوباره بفرست.');
  }else{
    lines.push('❌ نمایش موجودی — '+(wallet.status ?? 'عدم اتصال'),
      '↳ '+(wallet.status===null?'Timeout یا قطع ارتباط با RPC.':statusNote(wallet.status)));
  }
  lines.push('','⚠️ اگر /wallet هنوز خطا می‌دهد، نتیجه این گزارش را بدون اطلاعات محرمانه ارسال کن.');
  return lines.join('\n');
}
export async function walletDiagnosticCommand(message,env,send) {
  if(!isOwner(message,env)){
    if(message?.chat?.type==='private' &&
      Number.isSafeInteger(message.chat.id) &&
      Number.isSafeInteger(message.from?.id) &&
      message.from.id===message.chat.id) {
      await send('sendMessage',{
        chat_id:message.chat.id,
        text:'〰️ این حساب هنوز مجوز بررسی مدیریتی Wallet را ندارد.\n\n' +
          'Telegram User ID شما: ' + message.from.id +
          '\n\nدر Cloudflare، مقدار ADMIN_TELEGRAM_USER_ID را روی هر دو Worker بررسی کن. ' +
          'مقدار باید دقیقاً برابر شناسه نمایش‌داده‌شده باشد.'
      });
    }
    return;
  }
  const output=await diagnoseWallet(env,message.from.id);
  await send('sendMessage',{chat_id:message.chat.id,text:output});
}
