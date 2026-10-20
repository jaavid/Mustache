// Read-only, admin-authorized diagnostics for Polygon Amoy balance lookups.
// Never return upstream RPC URLs, errors, headers, credentials, or private keys.
import {createPublicClient,http,getAddress} from 'viem';
import {polygonAmoy} from 'viem/chains';
import {tokenAbi} from './chain.js';

const error = (stage,code) => ({ok:false,stage,code});
const makeClient = (env) => createPublicClient({
  chain:polygonAmoy,
  transport:http(env.AMOY_RPC_URL,{timeout:3500,retryCount:0}),
});

export async function diagnoseWalletRead(env,userId,clientFactory=makeClient) {
  let wallet;
  try {
    wallet=await env.DB.prepare('SELECT address FROM wallets WHERE telegram_user_id=?')
      .bind(userId).first();
  } catch {
    return error('database','WALLET_DB_READ_FAILED');
  }
  if (!wallet?.address) return error('wallet','WALLET_NOT_FOUND');
  if (typeof env.AMOY_RPC_URL !== 'string' ||
      !/^https:\/\/[^/\s]+/i.test(env.AMOY_RPC_URL)) {
    return error('configuration','RPC_URL_MISSING_OR_INVALID');
  }
  let address,contract,client;
  try {
    address=getAddress(wallet.address);
    contract=getAddress(env.NFIVE_CONTRACT);
    client=clientFactory(env);
  } catch {
    return error('configuration','INVALID_RPC_OR_TOKEN_CONFIG');
  }
  let chainId;
  try {chainId=await client.getChainId();}
  catch {return error('rpc','RPC_UNREACHABLE');}
  if (chainId!==80002) return error('rpc','RPC_CHAIN_MISMATCH');

  let bytecode;
  try {bytecode=await client.getCode({address:contract});}
  catch {return error('contract','RPC_GET_CODE_FAILED');}
  if (!bytecode || bytecode==='0x') return error('contract','TOKEN_CONTRACT_NOT_FOUND');

  try {
    const decimals=await client.readContract({address:contract,abi:tokenAbi,functionName:'decimals'});
    const symbol=await client.readContract({address:contract,abi:tokenAbi,functionName:'symbol'});
    if (!Number.isInteger(decimals) || decimals<0 || decimals>36 || typeof symbol!=='string')
      return error('contract','TOKEN_METADATA_INVALID');
  } catch {
    return error('contract','TOKEN_METADATA_READ_FAILED');
  }
  try {
    await client.readContract({address:contract,abi:tokenAbi,functionName:'balanceOf',args:[address]});
  } catch {
    return error('balances','TOKEN_BALANCE_READ_FAILED');
  }
  try {await client.getBalance({address});}
  catch {return error('balances','POL_BALANCE_READ_FAILED');}

  return {ok:true,stage:'complete',code:'BALANCE_READ_OK'};
}
