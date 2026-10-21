import {formatUnits} from 'viem';
import {telegramId,rankRewards,tokenRaw,completedTehranWeek} from './logic.js';

export const WELCOME_BATCH_ID='welcome-100-202610';
export const WELCOME_TOKENS='100';

export async function welcomeAllocations(env) {
  // A fixed batch ID provides idempotency; existing genesis batches block double grants.
  const [prior,rows]=await Promise.all([
    env.DB.prepare("SELECT batch_id,state FROM reward_batches WHERE source='genesis' AND batch_id<>? LIMIT 1")
      .bind(WELCOME_BATCH_ID).first(),
    env.DB.prepare('SELECT telegram_user_id FROM wallets ORDER BY telegram_user_id').all(),
  ]);
  if(prior)throw Error('GENESIS_ALREADY_EXISTS');
  const users=(rows.results||[]).map(x=>telegramId(x.telegram_user_id));
  // This first campaign is explicitly approved for the ORIGINAL 20 wallets.
  // New signups must not silently increase its recipients or change the budget.
  if(users.length!==20)throw Error('WELCOME_WALLET_COUNT_OUT_OF_RANGE');
  return {batchId:WELCOME_BATCH_ID,source:'genesis',count:users.length,
    total:String(users.length*100),
    allocations:users.map(id=>({telegramUserId:id,amount:WELCOME_TOKENS}))};
}

/** Read-only preview of last FULLY completed Tehran week, with explicit rank split. */
export async function weeklyPreview(env,nowMs=Date.now(),pool=env.WEEKLY_POOL_TOKENS||'10000',decimals=18) {
  if(!env.SCORES_DB)throw Error('SCORES_DB_MISSING');
  const {start,end}=completedTehranWeek(nowMs);
  const sql=[
    'WITH best AS (',
    'SELECT user_id,COALESCE(ranked_score,score) AS ranked_points,golden_perfect,',
    'ROW_NUMBER() OVER(PARTITION BY user_id',
    'ORDER BY COALESCE(ranked_score,score) DESC,golden_perfect DESC,finished_at ASC,id ASC) AS own_rank',
    'FROM game_rounds WHERE score IS NOT NULL AND finished_at>=? AND finished_at<?',
    "AND mode IN ('classic','goldRush')",
    ') SELECT CAST(user_id AS TEXT) AS telegram_user_id,ranked_points FROM best',
    'WHERE own_rank=1 ORDER BY ranked_points DESC,golden_perfect DESC,user_id ASC LIMIT 100',
  ].join(' ');
  const results=await env.SCORES_DB.prepare(sql).bind(start,end).all();
  const rows=results.results||[];
  const ids=rows.map(x=>telegramId(x.telegram_user_id));
  if(!ids.length)return {batchId:'weekly-'+start,start,end,eligible:0,pool,state:'EMPTY',winners:[]};
  const allocations=rankRewards(ids,tokenRaw(pool,decimals));
  const winners=allocations.map((row,i)=>({
    rank:i+1,telegramUserId:row.id,
    amount:formatUnits(BigInt(row.raw),decimals),
    score:Number(rows[i].ranked_points),
  }));
  return {batchId:'weekly-'+start,start,end,eligible:ids.length,pool,state:'PREVIEW',
    formula:'40_percent_equal_60_percent_ranked',winners};
}

/** Aggregate on-chain and Telegram delivery progress for the private /admin UI. */
export async function adminBatchSummary(db) {
  const sql=[
    'SELECT b.batch_id,b.source,b.state,b.total_raw,b.decimals,',
    'COUNT(a.operation_key) AS recipients,',
    "SUM(CASE WHEN t.state='CONFIRMED' THEN 1 ELSE 0 END) AS confirmed,",
    "SUM(CASE WHEN t.state IN ('SIGNED','SUBMITTED') THEN 1 ELSE 0 END) AS pending,",
    "SUM(CASE WHEN t.state IN ('FAILED','REVIEW_REQUIRED') THEN 1 ELSE 0 END) AS failed,",
    'SUM(CASE WHEN t.operation_key IS NULL THEN 1 ELSE 0 END) AS not_sent,',
    "SUM(CASE WHEN n.state='SENT' THEN 1 ELSE 0 END) AS notifications_sent,",
    "SUM(CASE WHEN n.state='FAILED' THEN 1 ELSE 0 END) AS notifications_failed,",
    "SUM(CASE WHEN n.state='ATTEMPTED' THEN 1 ELSE 0 END) AS notifications_unknown",
    'FROM reward_batches b',
    'LEFT JOIN allocations a ON a.batch_id=b.batch_id',
    'LEFT JOIN tx_jobs t ON t.operation_key=a.operation_key',
    'LEFT JOIN reward_notifications n ON n.operation_key=a.operation_key',
    'GROUP BY b.batch_id ORDER BY b.created_at DESC LIMIT 12',
  ].join(' ');
  const rows=await db.prepare(sql).all();
  return rows.results||[];
}

export async function adminBatchRecipients(db,batchId) {
  const batch=await db.prepare('SELECT batch_id,source,state,total_raw,decimals FROM reward_batches WHERE batch_id=?')
    .bind(batchId).first();
  if(!batch)return null;
  const sql=[
    'SELECT a.telegram_user_id,w.display_name,w.address,a.amount_raw,',
    "COALESCE(t.state,'NOT_SENT') AS tx_state,t.tx_hash,",
    "COALESCE(n.state,'NOT_NOTIFIED') AS notification_state,n.failure_code,n.telegram_message_id",
    'FROM allocations a JOIN wallets w USING(telegram_user_id)',
    'LEFT JOIN tx_jobs t ON t.operation_key=a.operation_key',
    'LEFT JOIN reward_notifications n ON n.operation_key=a.operation_key',
    'WHERE a.batch_id=? ORDER BY a.telegram_user_id LIMIT 100',
  ].join(' ');
  const rows=await db.prepare(sql).bind(batchId).all();
  return {batch,recipients:(rows.results||[]).map(row=>({
    telegramUserId:row.telegram_user_id,displayName:row.display_name,address:row.address,
    amount:formatUnits(BigInt(row.amount_raw),Number(batch.decimals)),
    transactionState:row.tx_state,txHash:row.tx_hash,
    notificationState:row.notification_state,
    notificationError:row.failure_code,telegramMessageId:row.telegram_message_id,
  }))};
}

/** Claim and persist BEFORE Telegram send; do not automatically replay ambiguous sends. */
export async function claimConfirmedNotification(db,now=Date.now()) {
  const sql=[
    'SELECT a.operation_key,a.telegram_user_id,a.amount_raw,b.decimals,b.source,b.batch_id,t.tx_hash',
    'FROM allocations a JOIN reward_batches b ON b.batch_id=a.batch_id',
    "JOIN tx_jobs t ON t.operation_key=a.operation_key AND t.state='CONFIRMED'",
    'LEFT JOIN reward_notifications n ON n.operation_key=a.operation_key',
    'WHERE n.operation_key IS NULL ORDER BY t.updated_at,a.operation_key LIMIT 1',
  ].join(' ');
  const row=await db.prepare(sql).first();
  if(!row)return {state:'EMPTY'};
  const statement='INSERT OR IGNORE INTO reward_notifications '+
    "(operation_key,telegram_user_id,state,attempted_at) VALUES (?,?,'ATTEMPTED',?)";
  const write=await db.prepare(statement).bind(row.operation_key,row.telegram_user_id,now).run();
  if(write.meta?.changes!==1)return {state:'RACE'};
  return {state:'CLAIMED',operationKey:row.operation_key,telegramUserId:row.telegram_user_id,
    batchId:row.batch_id,source:row.source,
    amount:formatUnits(BigInt(row.amount_raw),Number(row.decimals)),txHash:row.tx_hash};
}

export async function acknowledgeNotification(db,body,now=Date.now()) {
  const key=String(body?.operationKey||'');
  if(!/^reward:[a-zA-Z0-9_-]{3,75}:[1-9][0-9]{0,18}$/.test(key))
    throw Error('INVALID_OPERATION_KEY');
  const status=body?.status;
  if(status!=='SENT'&&status!=='FAILED')throw Error('INVALID_NOTIFICATION_STATE');
  const messageId=Number.isSafeInteger(body?.telegramMessageId)&&body.telegramMessageId>0
    ? body.telegramMessageId:null;
  const reason=status==='FAILED'?(body?.reason==='BLOCKED'?'BLOCKED':'SEND_FAILED'):null;
  const statement='UPDATE reward_notifications SET state=?,completed_at=?,telegram_message_id=?,failure_code=? '+
    "WHERE operation_key=? AND state='ATTEMPTED'";
  const update=await db.prepare(statement).bind(status,now,messageId,reason,key).run();
  return {state:update.meta?.changes===1?status:'ALREADY_RECORDED'};
}
