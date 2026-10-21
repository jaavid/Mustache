/**
 * Telegram distribution notifications are a separate, non-signing bot workflow.
 * Wallet Worker atomically claims a CONFIRMED tx once before any send attempt.
 * We never auto-retry an ambiguous Telegram delivery, avoiding duplicate spam.
 */
const WALLET_LINK='https://t.me/RJTtobot?start=wallet';
const EXPLORER='https://amoy.polygonscan.com/tx/';
const safeHash=h=>typeof h==='string'&&/^0x[a-f0-9]{64}$/i.test(h)?h:null;
const safeAmount=a=>typeof a==='string'&&/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(a)?a:null;

async function internal(env,path,body) {
  if(!env.WALLET_SERVICE_KEY||!env.ADMIN_TELEGRAM_USER_ID||!env.WALLET)
    throw Error('REWARD_NOTIFICATIONS_NOT_CONFIGURED');
  const url='https://wallet.internal'+path;
  const res=await env.WALLET.fetch(url,{
    method:'POST',headers:{
      'content-type':'application/json',
      'x-wallet-service-key':env.WALLET_SERVICE_KEY,
      'x-telegram-user-id':String(env.ADMIN_TELEGRAM_USER_ID),
    },
    body:JSON.stringify(body),signal:AbortSignal.timeout(7000),
  });
  if(!res.ok)throw Error('WALLET_NOTIFICATION_API_UNAVAILABLE');
  return res.json();
}

export function confirmedRewardText(item) {
  const hash=safeHash(item?.txHash),amount=safeAmount(item?.amount);
  if(!hash||!amount||!['genesis','weekly'].includes(item?.source))
    throw Error('INVALID_REWARD_EVENT');
  const name=item.source==='genesis'?'هدیه آغازین N5':'جایزه هفتگی N5';
  return [
    '〰️🎁 '+name+' به کیف پولت رسید!',
    '',
    '💰 '+amount+' tNFIVE آزمایشی',
    '✅ انتقال روی Polygon Amoy تأیید شد.',
    '',
    '💼 کیف پولت رو باز کن و موجودی رو ببین:',
    WALLET_LINK,
    '',
    '🔎 رسید تراکنش:',
    EXPLORER+hash,
    '',
    '〰️ بازی کن، امتیاز بگیر، سیبیل‌سالار شو!',
    '⚠️ این توکن‌ها تستی هستند و ارزش مالی واقعی ندارند.',
  ].join('\n');
}

export async function dispatchConfirmedRewards(env,send,max=5) {
  if(!Number.isInteger(max)||max<1||max>10)throw Error('INVALID_NOTIFICATION_LIMIT');
  const counts={sent:0,failed:0,unknown:0,empty:false};
  for(let n=0;n<max;n++) {
    const item=await internal(env,'/internal/admin/notifications/claim',{});
    if(item.state==='EMPTY') {counts.empty=true;break;}
    if(item.state!=='CLAIMED') {
      // Competing cron invocation. No retry of a claimed event.
      if(item.state==='RACE')break;
      throw Error('INVALID_REWARD_EVENT');
    }
    const id=String(item.telegramUserId);
    if(!/^[1-9][0-9]{0,18}$/.test(id))throw Error('INVALID_REWARD_RECIPIENT');
    let status='SENT',messageId=null,reason;
    try{
      const message=await send('sendMessage',{
        chat_id:id,text:confirmedRewardText(item),
        disable_web_page_preview:true,
        reply_markup:{inline_keyboard:[[
          {text:'💰 مشاهده کیف پول',url:WALLET_LINK},
        ]]},
      });
      messageId=Number.isSafeInteger(message?.message_id)?message.message_id:null;
    }catch(error){
      status='FAILED';
      reason=error?.message==='TELEGRAM_BLOCKED'?'BLOCKED':'SEND_FAILED';
    }
    // If acknowledgement fails, leave ATTEMPTED for MANUAL review. Never resend.
    try{
      await internal(env,'/internal/admin/notifications/ack',{
        operationKey:item.operationKey,status,telegramMessageId:messageId,reason,
      });
      counts[status==='SENT'?'sent':'failed']++;
    }catch{
      counts.unknown++;
    }
  }
  return counts;
}


/** Separately announce one-time payout milestones to the verified N5 operator. */
export function operatorMilestoneText(event) {
  const phase=event?.phase;
  if(!['PILOT_OK','PAUSED','COMPLETE'].includes(phase) ||
     !/^[a-zA-Z0-9_-]{3,75}$/.test(String(event?.batchId||'')))
    throw Error('INVALID_OPERATOR_EVENT');
  const received=Number(event.confirmed),total=Number(event.recipients);
  if(!Number.isSafeInteger(received)||!Number.isSafeInteger(total)||
     received<0||total<1||received>total)throw Error('INVALID_OPERATOR_EVENT');
  const title=phase==='PILOT_OK'
    ?'🧪✅ تراکنش آزمایشی تأیید شد'
    :phase==='COMPLETE'
      ?'🎁✅ توزیع آزمایشی تکمیل شد'
      :'⏸⚠️ توزیع متوقف شد';
  return [
    '〰️🛡️ N5 Admin · Polygon Amoy',
    title,
    '📦 '+event.batchId,
    '✅ '+received+' از '+total+' انتقال تأییدشده',
    '',
    phase==='PILOT_OK'
      ?'رسید نفر آزمایشی را از /admin بررسی کن؛ ادامه توزیع تنها با تأیید مجدد تو انجام می‌شود.'
      :phase==='COMPLETE'
        ?'همه پرداخت‌های این Batch تأیید شدند. وضعیت اعلان بازیکنان را در /admin بررسی کن.'
        :'تراکنش‌های جدید متوقف شده‌اند؛ ارسال‌های قبلی ممکن است هنوز در انتظار شبکه باشند.',
    '⚠️ همه مبالغ، توکن تستی N5 هستند.',
  ].join('\n');
}

export async function dispatchOperatorMilestones(env,send,max=3) {
  if(!Number.isInteger(max)||max<1||max>5)throw Error('INVALID_NOTIFICATION_LIMIT');
  let sent=0,failed=0,unknown=0;
  for(let i=0;i<max;i++){
    const event=await internal(env,'/internal/admin/operator/notice/claim',{});
    if(event.state==='EMPTY'||event.state==='RACE')break;
    if(event.state!=='CLAIMED')throw Error('INVALID_OPERATOR_EVENT');
    let state='SENT';
    try {
      await send('sendMessage',{
        chat_id:String(env.ADMIN_TELEGRAM_USER_ID),
        text:operatorMilestoneText(event),
        reply_markup:{inline_keyboard:[[{
          text:'📊 مشاهده وضعیت در /admin',callback_data:'na:d',
        }]]},
      });
    }catch{state='FAILED';}
    // Never resend an unknown-status Telegram message. Operator can inspect /admin.
    try {
      await internal(env,'/internal/admin/operator/notice/ack',{
        batchId:event.batchId,phase:event.phase,state,
      });
      if(state==='SENT')sent++;else failed++;
    }catch{unknown++;}
  }
  return {sent,failed,unknown};
}
