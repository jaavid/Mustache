// Optional wallet commands; never infer Telegram identity from client payload.
// Only messages authenticated by existing Telegram webhook reach this module.
const help='Wallet not configured yet. Try again after the N5 Wallet testnet launch.';
async function api(env,userId,path,method='GET',data) {
  if(!env.WALLET_SERVICE_KEY) throw new Error('WALLET_NOT_CONFIGURED');
  let endpoint;
  if (env.WALLET) endpoint='https://wallet.internal'+path;
  else if (env.WALLET_API_URL?.startsWith('https://')) endpoint=env.WALLET_API_URL.replace(/\/$/,'')+path;
  else throw new Error('WALLET_NOT_CONFIGURED');
  const options={method,headers:{'x-wallet-service-key':env.WALLET_SERVICE_KEY,'x-telegram-user-id':String(userId)}};
  if(data) {options.headers['content-type']='application/json';options.body=JSON.stringify(data);}
  const result=await (env.WALLET ? env.WALLET.fetch(endpoint,options) : fetch(endpoint,options));
  if(!result.ok) throw new Error('WALLET_API_ERROR');
  return result.json();
}
function human(raw,decimals=18) {
  const value=BigInt(raw||0).toString().padStart(Number(decimals)+1,'0');
  const d=Number(decimals);
  return d ? value.slice(0,-d)+'.'+value.slice(-d).replace(/0+$/,'').replace(/^$/,'0') : value;
}
export function parseWithdraw(text) {
  const parts=String(text||'').trim().split(/\s+/);
  if(parts.length!==3 || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(parts[1]) || !/^0x[a-fA-F0-9]{40}$/.test(parts[2])) return null;
  return {amount:parts[1],destination:parts[2]};
}
export async function walletCommand(message,command,env,send) {
  const chat=message.chat?.id,uid=message.from?.id;
  if (!Number.isSafeInteger(uid)||!Number.isSafeInteger(chat)) return;
  if(message.chat?.type!=='private') {
    await send('sendMessage',{chat_id:chat,text:'〰️ کیف پول شخصی است. برای دیدنش در پیام خصوصی به @RJTtobot برو.'});
    return;
  }
  const write=text=>send('sendMessage',{chat_id:chat,text});
  try {
    if(command==='wallet') {
      const r=await api(env,uid,'/internal/wallet');
      if(r.error) return write('〰️ هنوز کیف پول تستی برای حسابت ساخته نشده.');
      return write('〰️ N5 Wallet (Amoy Testnet)\nموجودی: '+r.balance+' '+r.symbol+'\nGas: '+r.pol+' POL\nآدرس: '+r.address+'\n'+r.explorer);
    }
    if(command==='rewards'||command==='transactions') {
      const r=await api(env,uid,'/internal/history');
      const lines=[];
      for(const x of r.rewards.slice(0,8)) {
        const details=x.txHash ? '\nhttps://amoy.polygonscan.com/tx/'+x.txHash : '';
        lines.push('〰️ '+x.batchId+' · '+human(x.amountRaw,x.decimals)+' tNFIVE · '+(x.state||'PLANNED')+details);
      }
      if(command==='transactions') for(const x of r.withdrawals.slice(0,5)) {
        lines.push('↗️ Withdrawal · '+x.state+(x.txHash?'\nhttps://amoy.polygonscan.com/tx/'+x.txHash:''));
      }
      return write(lines.length?lines.join('\n\n'):'تراکنش یا پاداشی ثبت نشده است.');
    }
    if(command==='withdraw') {
      const form=parseWithdraw(message.text);
      if(!form) return write('فرمت درخواست برداشت:\n/withdraw 25 0xYourWalletAddress\nفقط tNFIVE تستی روی Polygon Amoy.');
      const result=await api(env,uid,'/internal/withdrawals','POST',form);
      return send('sendMessage',{chat_id:chat,text:'درخواست برداشت تستی '+result.amount+' tNFIVE\nمقصد: '+result.destination+'\nبرای تأیید نهایی دکمه زیر را بزن:',reply_markup:{inline_keyboard:[[{text:'تأیید برداشت',callback_data:'wd:'+result.requestId}]]}});
    }
  } catch {
    await write(help);
  }
}
export async function confirmWalletCallback(callback,env,send) {
  const answer=text=>send('answerCallbackQuery',{callback_query_id:callback.id,text,show_alert:false,cache_time:0});
  if(callback.message?.chat?.type!=='private'||!Number.isSafeInteger(callback.from?.id)) return answer('درخواست نامعتبر');
  const match=/^wd:([a-f0-9-]{36})$/i.exec(callback.data||'');
  if(!match) return answer('درخواست نامعتبر');
  try {
    await api(env,callback.from.id,'/internal/withdrawals/'+match[1]+'/confirm','POST');
    await answer('درخواست ثبت شد');
    await send('sendMessage',{chat_id:callback.message.chat.id,text:'〰️ برداشت تأیید شد و در صف پردازش Amoy قرار گرفت. وضعیت را در /transactions ببین.'});
  } catch {
    await answer('این درخواست دیگر قابل تأیید نیست یا سرویس آماده نیست');
  }
}
