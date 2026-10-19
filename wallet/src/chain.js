import { createPublicClient, http, getAddress, formatUnits, parseAbi, encodeFunctionData, keccak256 } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { unwrapKey } from './security.js';
import { tokenRaw } from './logic.js';

export const tokenAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)'
]);
export function rpc(env) {
  if (!env.AMOY_RPC_URL?.startsWith('https://')) throw new Error('RPC_NOT_CONFIGURED');
  return createPublicClient({chain:polygonAmoy,transport:http(env.AMOY_RPC_URL,{timeout:12000,retryCount:1})});
}
export async function context(env) {
  if (env.CHAIN_ID !== '80002') throw new Error('CHAIN_MISMATCH');
  const client=rpc(env);
  if ((await client.getChainId())!==80002) throw new Error('CHAIN_MISMATCH');
  const contract=getAddress(env.NFIVE_CONTRACT);
  const bytecode=await client.getCode({address:contract});
  if(!bytecode || bytecode==='0x') throw new Error('CONTRACT_NOT_DEPLOYED');
  const [decimals,symbol]=await Promise.all([
    client.readContract({address:contract,abi:tokenAbi,functionName:'decimals'}),
    client.readContract({address:contract,abi:tokenAbi,functionName:'symbol'})
  ]);
  if (!Number.isInteger(decimals)||decimals<0||decimals>36) throw new Error('INVALID_DECIMALS');
  return {client,contract,decimals,symbol};
}
export async function balance(env,address) {
  const {client,contract,decimals,symbol}=await context(env);
  const wallet=getAddress(address);
  const [tokens,pol]=await Promise.all([
    client.readContract({address:contract,abi:tokenAbi,functionName:'balanceOf',args:[wallet]}),
    client.getBalance({address:wallet})
  ]);
  return {address:wallet,symbol,balance:formatUnits(tokens,decimals),pol:formatUnits(pol,18)};
}
export function distributor(env) {
  if (!env.DISTRIBUTOR_PRIVATE_KEY || !/^0x[a-fA-F0-9]{64}$/.test(env.DISTRIBUTOR_PRIVATE_KEY)) throw new Error('DISTRIBUTOR_NOT_CONFIGURED');
  const account=privateKeyToAccount(env.DISTRIBUTOR_PRIVATE_KEY);
  if (account.address.toLowerCase()===env.ADMIN_ADDRESS.toLowerCase()) throw new Error('TREASURY_KEY_FORBIDDEN');
  return account;
}
async function userSigner(env,telegramUserId) {
  const row=await env.DB.prepare('SELECT key_cipher,key_iv,address FROM wallets WHERE telegram_user_id=?').bind(telegramUserId).first();
  if (!row) throw new Error('WALLET_NOT_FOUND');
  const key=await unwrapKey(row,telegramUserId,env.WALLET_ENCRYPTION_KEY);
  const account=privateKeyToAccount(key);
  if (account.address.toLowerCase()!==row.address.toLowerCase()) throw new Error('WALLET_KEY_MISMATCH');
  return account;
}
function isPending(state) { return state==='SIGNED'||state==='SUBMITTED'; }
async function receiptState(client,job,db) {
  if (!isPending(job.state)) return {state:job.state,txHash:job.tx_hash};
  try {
    const receipt=await client.getTransactionReceipt({hash:job.tx_hash});
    const head=await client.getBlockNumber();
    if(head < receipt.blockNumber + 2n) return {state:'PENDING',txHash:job.tx_hash};
    const state=receipt.status==='success'?'CONFIRMED':'FAILED';
    await db.prepare('UPDATE tx_jobs SET state=?,updated_at=? WHERE operation_key=? AND state IN (\'SIGNED\',\'SUBMITTED\')')
      .bind(state,Date.now(),job.operation_key).run();
    return {state,txHash:job.tx_hash};
  } catch {
    // RPC failure/unknown receipt does not authorize a fresh nonce or payment.
    return {state:'PENDING',txHash:job.tx_hash};
  }
}
async function existingJob(env,client,key) {
  const found=await env.DB.prepare('SELECT * FROM tx_jobs WHERE operation_key=?').bind(key).first();
  if (!found) return null;
  const result=await receiptState(client,found,env.DB);
  if (result.state==='PENDING') {
    try {
      await client.sendRawTransaction({serializedTransaction:found.signed_raw});
      if (found.state==='SIGNED') {
        await env.DB.prepare("UPDATE tx_jobs SET state='SUBMITTED',updated_at=? WHERE operation_key=? AND state='SIGNED'")
          .bind(Date.now(),key).run();
      }
    } catch {
      // A timeout, already-known transaction or RPC error is ambiguous.
      // Keep signed raw transaction for an exact replay; never sign again.
    }
  }
  return result;
}
export async function sendOnce(env,operationKey,signer,recipient,value,data,kind) {
  if (env.TRANSFERS_ENABLED!=='true') throw new Error('TRANSFERS_DISABLED');
  const {client}=await context(env);
  const previous=await existingJob(env,client,operationKey);
  if (previous) return previous;
  const sender=getAddress(signer.address);
  const pending=await env.DB.prepare("SELECT * FROM tx_jobs WHERE lower(sender)=lower(?) AND state IN ('SIGNED','SUBMITTED') ORDER BY created_at LIMIT 1")
    .bind(sender).first();
  if (pending) {
    await receiptState(client,pending,env.DB);
    const still=await env.DB.prepare("SELECT 1 FROM tx_jobs WHERE operation_key=? AND state IN ('SIGNED','SUBMITTED')").bind(pending.operation_key).first();
    if (still) return {state:'BLOCKED_BY_PENDING',blockingTxHash:pending.tx_hash};
  }
  const to=getAddress(recipient);
  const amount=BigInt(value);
  const calldata=data||'0x';
  const [nonce,estimated,gasPrice,nativeBalance]=await Promise.all([
    client.getTransactionCount({address:sender,blockTag:'pending'}),
    client.estimateGas({account:sender,to,value:amount,data:calldata}),
    client.getGasPrice(),
    client.getBalance({address:sender})
  ]);
  const gas=estimated*12n/10n+1000n;
  const price=gasPrice*12n/10n+1n;
  if (gas*price+amount>nativeBalance) throw new Error('INSUFFICIENT_TEST_POL');
  const signed=await signer.signTransaction({chainId:80002,type:'legacy',to,value:amount,data:calldata,nonce,gas,gasPrice:price});
  const hash=keccak256(signed);
  const timestamp=Date.now();
  // Durable Object serializes transaction creation; D1 stores signed tx before RPC broadcast.
  await env.DB.prepare("INSERT INTO tx_jobs(operation_key,sender,target,kind,value_raw,call_data,nonce,tx_hash,signed_raw,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'SIGNED',?,?)")
    .bind(operationKey,sender,to,kind,String(amount),calldata,nonce,hash,signed,timestamp,timestamp).run();
  try {
    await client.sendRawTransaction({serializedTransaction:signed});
    await env.DB.prepare("UPDATE tx_jobs SET state='SUBMITTED',updated_at=? WHERE operation_key=?").bind(Date.now(),operationKey).run();
  } catch {
    // Intent retained. A future tick broadcasts the SAME raw transaction.
  }
  return {state:'PENDING',txHash:hash};
}
export async function tokenTransfer(env,operationKey,account,destination,amountRaw) {
  const {contract}=await context(env);
  const data=encodeFunctionData({abi:tokenAbi,functionName:'transfer',args:[getAddress(destination),BigInt(amountRaw)]});
  return sendOnce(env,operationKey,account,contract,0n,data,'TOKEN');
}
export async function gasTransfer(env,operationKey,destination,amountWei) {
  return sendOnce(env,operationKey,distributor(env),destination,BigInt(amountWei),'0x','GAS');
}
export async function withdrawalStep(env,row) {
  const {client,contract,decimals}=await context(env);
  const wallet=await env.DB.prepare('SELECT * FROM wallets WHERE telegram_user_id=?').bind(row.telegram_user_id).first();
  if (!wallet) throw new Error('WALLET_NOT_FOUND');
  const destination=getAddress(row.destination);
  const opToken='withdraw:'+row.id+':token';
  const recorded=await existingJob(env,client,opToken);
  if (recorded) {
    if (recorded.state==='CONFIRMED') await env.DB.prepare("UPDATE withdrawals SET state='COMPLETE' WHERE id=?").bind(row.id).run();
    if (recorded.state==='FAILED'||recorded.state==='REVIEW_REQUIRED') await env.DB.prepare("UPDATE withdrawals SET state='REVIEW_REQUIRED' WHERE id=?").bind(row.id).run();
    return recorded;
  }
  const tokenBalance=await client.readContract({address:contract,abi:tokenAbi,functionName:'balanceOf',args:[getAddress(wallet.address)]});
  if (tokenBalance<BigInt(row.amount_raw)) throw new Error('INSUFFICIENT_NFIVE');
  const data=encodeFunctionData({abi:tokenAbi,functionName:'transfer',args:[destination,BigInt(row.amount_raw)]});
  // eth_estimateGas may reject an unfunded sender before token execution.
  // Prefund conservatively, then sendOnce estimates the actual ERC-20 gas.
  const [price,pol]=await Promise.all([
    client.getGasPrice(),
    client.getBalance({address:getAddress(wallet.address)})
  ]);
  const needed=125000n*(price*12n/10n+1n);
  if (pol<needed) {
    const gasOp='withdraw:'+row.id+':gas';
    const previous=await existingJob(env,client,gasOp);
    if (previous?.state==='FAILED') throw new Error('GAS_TRANSFER_FAILED');
    if (previous?.state==='PENDING') return previous;
    if (previous?.state==='CONFIRMED') throw new Error('GAS_TOPUP_INADEQUATE');
    const topup=needed*2n-pol;
    if (topup>tokenRaw(env.MAX_GAS_TOPUP_POL||'0.005',18)) throw new Error('GAS_TOPUP_LIMIT');
    const outcome=await gasTransfer(env,gasOp,wallet.address,topup);
    await env.DB.prepare("UPDATE withdrawals SET state='GAS_PENDING' WHERE id=?").bind(row.id).run();
    return outcome;
  }
  const signer=await userSigner(env,row.telegram_user_id);
  const outcome=await tokenTransfer(env,opToken,signer,destination,row.amount_raw);
  await env.DB.prepare("UPDATE withdrawals SET state='TOKEN_PENDING' WHERE id=?").bind(row.id).run();
  return outcome;
}
export async function processNext(env) {
  if (env.TRANSFERS_ENABLED!=='true') return {state:'DISABLED'};
  const {client}=await context(env);
  // Reconcile all outstanding jobs first. A sender cannot advance its nonce
  // until its previous signed job reaches a terminal receipt state.
  const outstanding=await env.DB.prepare("SELECT * FROM tx_jobs WHERE state IN ('SIGNED','SUBMITTED') ORDER BY created_at LIMIT 30").all();
  for (const job of outstanding.results) await existingJob(env,client,job.operation_key);
  await env.DB.prepare(`UPDATE reward_batches SET state='REVIEW_REQUIRED' WHERE state='APPROVED'
    AND EXISTS (SELECT 1 FROM allocations a JOIN tx_jobs t ON t.operation_key=a.operation_key
      WHERE a.batch_id=reward_batches.batch_id AND t.state IN ('FAILED','REVIEW_REQUIRED'))`).run();
  await env.DB.prepare(`UPDATE reward_batches SET state='COMPLETE' WHERE state='APPROVED'
    AND NOT EXISTS (SELECT 1 FROM allocations a LEFT JOIN tx_jobs t ON t.operation_key=a.operation_key
      WHERE a.batch_id=reward_batches.batch_id AND COALESCE(t.state,'NOT_SENT')!='CONFIRMED')`).run();
  // Only independently approved batches can create signed blockchain transactions.
  const line=await env.DB.prepare(`SELECT a.*,w.address FROM allocations a
    JOIN wallets w USING(telegram_user_id)
    JOIN reward_batches b ON b.batch_id=a.batch_id AND b.state='APPROVED'
    WHERE NOT EXISTS(SELECT 1 FROM tx_jobs t WHERE t.operation_key=a.operation_key
      AND t.state IN ('CONFIRMED','FAILED','REVIEW_REQUIRED'))
    ORDER BY a.batch_id,a.telegram_user_id LIMIT 1`).first();
  if (line) {
    const outcome=await tokenTransfer(env,line.operation_key,distributor(env),line.address,line.amount_raw);
    return {operation:line.operation_key,...outcome};
  }
  const withdraw=await env.DB.prepare("SELECT * FROM withdrawals WHERE state IN ('READY','GAS_PENDING','TOKEN_PENDING') ORDER BY confirmed_at LIMIT 1").first();
  if (withdraw) {
    try {return {withdrawalId:withdraw.id,...await withdrawalStep(env,withdraw)};}
    catch {await env.DB.prepare("UPDATE withdrawals SET state='REVIEW_REQUIRED' WHERE id=?").bind(withdraw.id).run();return {withdrawalId:withdraw.id,state:'REVIEW_REQUIRED'};}
  }
  return {state:'IDLE'};
}
