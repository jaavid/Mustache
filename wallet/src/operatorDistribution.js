import {formatUnits,encodeFunctionData} from 'viem';
import {context,distributor,tokenAbi} from './chain.js';
import {tokenRaw,completedTehranWeek} from './logic.js';
import {welcomeAllocations,weeklyPreview} from './distribution.js';
import {sha256} from './security.js';

const LEGACY='genesis-0';
const WELCOME='welcome-100-202610';
const VALID=new Set(['welcome','weekly']);
const GWEI=10n**18n;
const asCount=value=>Number(value||0);
const numAmount=(value,decimals)=>formatUnits(BigInt(value),decimals);

/**
 * Inspect existing legacy 10k genesis without changing the ledger.
 * It is convertible ONLY if the 20 original allocations have no signed tx jobs.
 */
async function inspectLegacy(env) {
  const row=await env.DB.prepare('SELECT * FROM reward_batches WHERE batch_id=?').bind(LEGACY).first();
  if(!row)return null;
  const allocations=await env.DB.prepare(
    'SELECT telegram_user_id,amount_raw,operation_key FROM allocations WHERE batch_id=? ORDER BY telegram_user_id'
  ).bind(LEGACY).all();
  const jobs=await env.DB.prepare(
    'SELECT COUNT(*) AS total FROM allocations a JOIN tx_jobs t ON t.operation_key=a.operation_key WHERE a.batch_id=?'
  ).bind(LEGACY).first();
  const items=allocations.results||[];
  const wallets=await env.DB.prepare('SELECT telegram_user_id FROM wallets ORDER BY telegram_user_id').all();
  const ids=(wallets.results||[]).map(x=>String(x.telegram_user_id));
  const exactCohort=items.length===20 && ids.length===20 &&
    items.every((x,i)=>String(x.telegram_user_id)===ids[i]);
  const eligible=row.source==='genesis' && row.state==='PLANNED' &&
    exactCohort && asCount(jobs?.total)===0;
  const isWelcome=row.source==='genesis' && items.length===20 &&
    BigInt(row.total_raw)===tokenRaw('2000',Number(row.decimals)) &&
    items.every(x=>BigInt(x.amount_raw)===tokenRaw('100',Number(row.decimals)));
  return {row,items,eligible,isWelcome,jobs:asCount(jobs?.total)};
}

/** Reuse the existing genesis-0 record and all operation keys; no duplicate 10k Batch. */
export async function prepareWelcome(env,planFn) {
  const old=await inspectLegacy(env);
  if(!old)return planFn(env,await welcomeAllocations(env),'genesis');
  if(!old.eligible&&!old.isWelcome)throw Error('LEGACY_GENESIS_REVIEW_REQUIRED');
  if(old.isWelcome)return {
    batchId:LEGACY,state:'ALREADY_PLANNED',count:20,total:'2000',legacyReused:true
  };
  const decimals=Number(old.row.decimals);
  const {contract}=await context(env);
  // Only a legacy draft with 20 unsent slots may be changed. Audit its old sum.
  const value=tokenRaw('100',decimals).toString();
  const newSum=tokenRaw('2000',decimals).toString();
  const items=old.items.map(x=>({id:String(x.telegram_user_id),raw:value}));
  const digest=await sha256(JSON.stringify({
    batchId:LEGACY,token:contract.toLowerCase(),decimals,items
  }));
  const auditId=crypto.randomUUID(),now=Date.now();
  await env.DB.batch([
    ...old.items.map(x=>env.DB.prepare(
      'UPDATE allocations SET amount_raw=? WHERE batch_id=? AND telegram_user_id=?'
    ).bind(value,LEGACY,String(x.telegram_user_id))),
    env.DB.prepare("UPDATE reward_batches SET total_raw=?,digest=? WHERE batch_id=? AND state='PLANNED'")
      .bind(newSum,digest,LEGACY),
    env.DB.prepare('INSERT INTO audit_events(event_id,action,reference,created_at) VALUES(?,?,?,?)')
      .bind(auditId,'LEGACY_GENESIS_REPLANNED_100',LEGACY,now)
  ]);
  return {batchId:LEGACY,state:'PLANNED',count:20,total:'2000',legacyReused:true,
    priorTotal:numAmount(old.row.total_raw,decimals)};
}

/** Exact existing batch or original 20-wallet preview, with no mutations. */
export async function operatorOverview(env) {
  const wallets=await env.DB.prepare('SELECT COUNT(*) AS count FROM wallets').first();
  const genesis=await inspectLegacy(env);
  const welcome=await env.DB.prepare('SELECT batch_id,state,total_raw,decimals FROM reward_batches WHERE batch_id=?')
    .bind(WELCOME).first();
  const week=completedTehranWeek(Date.now());
  const weeklyId='weekly-'+week.start;
  const weekly=await env.DB.prepare('SELECT batch_id,state,total_raw,decimals FROM reward_batches WHERE batch_id=?')
    .bind(weeklyId).first();
  const runs=await env.DB.prepare('SELECT batch_id,phase,pilot_user_id FROM operator_payout_runs ORDER BY created_at DESC LIMIT 5').all();
  const {client,contract,decimals,symbol}=await context(env);
  const signer=distributor(env);
  const [tokens,pol,gasPrice]=await Promise.all([
    client.readContract({address:contract,abi:tokenAbi,functionName:'balanceOf',args:[signer.address]}),
    client.getBalance({address:signer.address}),client.getGasPrice()
  ]);
  return {
    chainId:80002,contract,symbol,decimals,signer:signer.address,
    wallets:asCount(wallets?.count),transfersEnabled:env.TRANSFERS_ENABLED==='true',
    autoRewardsEnabled:env.AUTO_REWARDS_ENABLED==='true',
    manualOnly:env.MANUAL_REWARDS_ONLY==='true',
    availableTokens:numAmount(tokens,decimals),availablePol:numAmount(pol,18),
    gasPriceWei:gasPrice.toString(),
    legacy:genesis?{
      batchId:LEGACY,state:genesis.row.state,
      total:numAmount(genesis.row.total_raw,Number(genesis.row.decimals)),
      hasSignedTransactions:genesis.jobs>0,
      canConvert:genesis.eligible||genesis.isWelcome,
      alreadyFixed:genesis.isWelcome,
    }:null,
    welcome:welcome?{batchId:welcome.batch_id,state:welcome.state,
      total:numAmount(welcome.total_raw,Number(welcome.decimals))}:null,
    weekly:weekly?{batchId:weekly.batch_id,state:weekly.state,
      total:numAmount(weekly.total_raw,Number(weekly.decimals))}:null,
    runs:runs.results||[],
    approvedWeeklyPool:env.WEEKLY_POOL_TOKENS||'10000',
  };
}

export async function batchForKind(env,kind) {
  if(!VALID.has(kind))throw Error('INVALID_OPERATOR_KIND');
  const overview=await operatorOverview(env);
  if(kind==='welcome'){
    if(overview.wallets!==20 && !overview.legacy?.alreadyFixed && !overview.welcome)
      throw Error('WELCOME_WALLET_COUNT_OUT_OF_RANGE');
    if(overview.legacy){
      if(!overview.legacy.canConvert)throw Error('LEGACY_GENESIS_REVIEW_REQUIRED');
      return {kind,batchId:LEGACY,state:overview.legacy.state,total:overview.legacy.total,overview,
        legacyNeedsCorrection:!overview.legacy.alreadyFixed};
    }
    if(overview.welcome)return {kind,...overview.welcome,overview};
    return {kind,batchId:WELCOME,state:'NOT_PREPARED',total:'2000',overview};
  }
  const preview=await weeklyPreview(env,Date.now(),env.WEEKLY_POOL_TOKENS||'10000',overview.decimals);
  if(preview.state==='EMPTY')throw Error('WEEKLY_NO_ELIGIBLE_PLAYERS');
  const missing=await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM wallets WHERE telegram_user_id IN ('+
    preview.winners.map(()=>'?').join(',')+')'
  ).bind(...preview.winners.map(x=>x.telegramUserId)).first();
  if(asCount(missing?.count)!==preview.eligible)throw Error('WEEKLY_MISSING_WALLETS');
  const found=overview.weekly;
  return {kind,batchId:preview.batchId,state:found?.state||'NOT_PREPARED',
    total:found?.total||preview.pool,overview,eligible:preview.eligible,
    winners:preview.winners.slice(0,5)};
}

/** Estimate budget for the actual Batch before ticket issuance and consumption. */
async function safeToStart(env,batchId,stage) {
  if(env.TRANSFERS_ENABLED!=='true')throw Error('TRANSFERS_DISABLED');
  if(env.MANUAL_REWARDS_ONLY!=='true')throw Error('MANUAL_MODE_REQUIRED');
  if(env.AUTO_REWARDS_ENABLED==='true')throw Error('AUTOMATIC_REWARDS_MUST_BE_DISABLED');
  const {client,contract,decimals}=await context(env);
  const signer=distributor(env);
  const batch=await env.DB.prepare('SELECT * FROM reward_batches WHERE batch_id=?').bind(batchId).first();
  if(!batch||!['PLANNED','APPROVED'].includes(batch.state))
    throw Error('BATCH_NOT_STARTABLE');
  if(batch.source==='genesis'&&BigInt(batch.total_raw)!==tokenRaw('2000',decimals))
    throw Error('UNSAFE_LEGACY_GENESIS_AMOUNT');
  if(batch.source==='weekly'&&BigInt(batch.total_raw)!==tokenRaw('10000',decimals))
    throw Error('WEEKLY_BUDGET_MISMATCH');
  const allocations=await env.DB.prepare(
    'SELECT a.telegram_user_id,a.amount_raw,w.address,t.state AS tx_state FROM allocations a '+
    'JOIN wallets w ON w.telegram_user_id=a.telegram_user_id '+
    'LEFT JOIN tx_jobs t ON t.operation_key=a.operation_key '+
    'WHERE a.batch_id=? ORDER BY a.telegram_user_id'
  ).bind(batchId).all();
  const rows=allocations.results||[];
  if(!rows.length||rows.length>100)throw Error('INVALID_BATCH_RECIPIENTS');
  const existing=rows.filter(x=>x.tx_state);
  if(stage==='PILOT'&&existing.length)throw Error('PILOT_ALREADY_ATTEMPTED');
  const remaining=rows.filter(x=>!x.tx_state);
  const gasCount=stage==='PILOT'?1:remaining.length;
  const [balance,pol,price]=await Promise.all([
    client.readContract({address:contract,abi:tokenAbi,functionName:'balanceOf',args:[signer.address]}),
    client.getBalance({address:signer.address}),client.getGasPrice()
  ]);
  const outstanding=remaining.reduce((sum,row)=>sum+BigInt(row.amount_raw),0n);
  if(balance<outstanding)throw Error('DISTRIBUTOR_LOW_BALANCE');
  const test=remaining[0]||rows[0];
  const data=encodeFunctionData({abi:tokenAbi,functionName:'transfer',args:[
    test.address,BigInt(test.amount_raw)
  ]});
  const gas=await client.estimateGas({account:signer.address,to:contract,data,value:0n});
  // Twofold gas margin plus buffer, to avoid commencing a campaign with
  // insufficient POL; if estimates change, the sender still checks per tx.
  const minimum=gas*price*BigInt(gasCount)*2n+5n*10n**15n;
  if(pol<minimum)throw Error('DISTRIBUTOR_LOW_GAS');
  const run=await env.DB.prepare('SELECT phase,pilot_user_id FROM operator_payout_runs WHERE batch_id=?')
    .bind(batchId).first();
  if(stage==='ALL'&&run?.phase!=='PILOT_OK')throw Error('PILOT_NOT_CONFIRMED');
  if(stage==='PILOT'&&run)throw Error('PILOT_ALREADY_CREATED');
  const running=await env.DB.prepare(
    "SELECT batch_id FROM operator_payout_runs WHERE phase IN ('PILOT','ALL') AND batch_id<>? LIMIT 1"
  ).bind(batchId).first();
  if(running)throw Error('ANOTHER_BATCH_RUNNING');
  return {batchId,stage,recipients:rows.length,remaining:remaining.length,
    pilotUserId:String(rows[0].telegram_user_id),budget:numAmount(outstanding,decimals),
    estimatedGasPol:numAmount(minimum,18)};
}

export async function prepareOperatorBatch(env,kind,planFn,weeklyPlanFn) {
  const preview=await batchForKind(env,kind);
  if(preview.kind==='welcome')return prepareWelcome(env,planFn);
  if(preview.state!=='NOT_PREPARED')return {
    batchId:preview.batchId,state:'ALREADY_PLANNED',total:preview.total
  };
  // Reuse the existing explicit-manual weekly planner without enabling the cron.
  return weeklyPlanFn({...env,AUTO_REWARDS_ENABLED:'true'},Date.now(),false);
}

export async function operatorAction(env,body,planFn,weeklyPlanFn,approveFn) {
  const action=String(body?.action||''),kind=String(body?.kind||'');
  if(action==='status')return operatorOverview(env);
  if(action==='preview')return batchForKind(env,kind);
  if(action==='prepare')return prepareOperatorBatch(env,kind,planFn,weeklyPlanFn);
  if(action==='pause'){
    const batch=await batchForKind(env,kind);
    const result=await env.DB.prepare(
      "UPDATE operator_payout_runs SET phase='PAUSED',updated_at=? WHERE batch_id=? AND phase IN ('PILOT','ALL')"
    ).bind(Date.now(),batch.batchId).run();
    return {batchId:batch.batchId,phase:result.meta?.changes===1?'PAUSED':'UNCHANGED'};
  }
  if(action==='ticket'){
    if(!['PILOT','ALL'].includes(body?.stage))throw Error('INVALID_OPERATOR_STAGE');
    const batch=await batchForKind(env,kind);
    const safe=await safeToStart(env,batch.batchId,body.stage);
    const ticket=crypto.randomUUID(),now=Date.now();
    await env.DB.prepare(
      'INSERT INTO operator_payout_tickets(ticket,batch_id,operation,expires_at,created_at) VALUES (?,?,?,?,?)'
    ).bind(ticket,batch.batchId,body.stage,now+5*60_000,now).run();
    return {...safe,state:'AWAITING_SECOND_CONFIRMATION',ticket,expiresAt:now+5*60_000};
  }
  if(action==='confirm'){
    const ticket=String(body?.ticket||'');
    if(!/^[a-f0-9-]{36}$/i.test(ticket))throw Error('INVALID_OPERATOR_TICKET');
    const row=await env.DB.prepare('SELECT * FROM operator_payout_tickets WHERE ticket=?').bind(ticket).first();
    if(!row||row.consumed_at||row.expires_at<Date.now())throw Error('OPERATOR_TICKET_EXPIRED');
    await safeToStart(env,row.batch_id,row.operation);
    const now=Date.now();
    const consume=await env.DB.prepare(
      'UPDATE operator_payout_tickets SET consumed_at=? WHERE ticket=? AND consumed_at IS NULL AND expires_at>=?'
    ).bind(now,ticket,now).run();
    if(consume.meta?.changes!==1)throw Error('OPERATOR_TICKET_USED');
    // Operator approval is separate from batch creation and on-chain signing.
    if(row.operation==='PILOT')await approveFn(env,row.batch_id);
    if(row.operation==='PILOT'){
      const first=await env.DB.prepare(
        'SELECT telegram_user_id FROM allocations WHERE batch_id=? ORDER BY telegram_user_id LIMIT 1'
      ).bind(row.batch_id).first();
      await env.DB.prepare(
        "INSERT INTO operator_payout_runs(batch_id,phase,pilot_user_id,created_at,updated_at) VALUES (?,'PILOT',?,?,?)"
      ).bind(row.batch_id,String(first.telegram_user_id),now,now).run();
    }else{
      const update=await env.DB.prepare(
        "UPDATE operator_payout_runs SET phase='ALL',updated_at=? WHERE batch_id=? AND phase='PILOT_OK'"
      ).bind(now,row.batch_id).run();
      if(update.meta?.changes!==1)throw Error('PILOT_NOT_CONFIRMED');
    }
    return {batchId:row.batch_id,phase:row.operation,state:'QUEUED',
      detail:'On-chain execution starts in the next serialized Wallet cron tick.'};
  }
  throw Error('INVALID_OPERATOR_ACTION');
}
