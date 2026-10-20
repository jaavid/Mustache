import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseWalletRead} from '../src/readDiagnostics.js';

const addr='0x'+'1'.repeat(40);
const contract='0x'+'2'.repeat(40);
function envWith(overrides={}){
  return {
    AMOY_RPC_URL:'https://example.invalid/rpc',
    NFIVE_CONTRACT:contract,
    DB:{prepare(sql) {
      assert.match(sql,/SELECT address FROM wallets/);
      return {bind(id) {
        assert.equal(id,'208627');
        return {async first(){return {address:addr};}};
      }};
    }},
    ...overrides
  };
}
const client=()=>({
  async getChainId(){return 80002;},
  async getCode(){return '0x60016000';},
  async readContract({functionName}){
    if(functionName==='decimals')return 18;
    if(functionName==='symbol')return 'tNFIVE';
    if(functionName==='balanceOf')return 0n;
    throw Error('unexpected');
  },
  async getBalance(){return 0n;}
});
test('missing RPC URL is diagnosed without requesting any network transport',async()=>{
  const output=await diagnoseWalletRead(envWith({AMOY_RPC_URL:undefined}),'208627',()=>{
    throw Error('must not attempt RPC');
  });
  assert.deepEqual(output,{ok:false,stage:'configuration',code:'RPC_URL_MISSING_OR_INVALID'});
  assert.equal(JSON.stringify(output).includes('https:'),false);
});
test('wrong RPC chain is reported independently from D1 and contract',async()=>{
  const outcome=await diagnoseWalletRead(envWith(),'208627',()=>({...client(),getChainId:async()=>1}));
  assert.equal(outcome.code,'RPC_CHAIN_MISMATCH');
});
test('unreachable RPC is categorized without returning upstream secrets or thrown error',async()=>{
  const outcome=await diagnoseWalletRead(envWith(),'208627',()=>({
    ...client(),getChainId:async()=>{throw new Error('Provider API token PRIVATE-KEY-SECRET');}
  }));
  assert.equal(outcome.code,'RPC_UNREACHABLE');
  assert.equal(JSON.stringify(outcome).includes('PRIVATE-KEY-SECRET'),false);
});
test('missing deployed ERC20 bytecode has a distinct diagnosis',async()=>{
  const outcome=await diagnoseWalletRead(envWith(),'208627',()=>({...client(),getCode:async()=>undefined}));
  assert.equal(outcome.code,'TOKEN_CONTRACT_NOT_FOUND');
});
test('ERC20 read failure does not get mislabeled as missing wallet',async()=>{
  const outcome=await diagnoseWalletRead(envWith(),'208627',()=>({
    ...client(),readContract:async({functionName})=>{
      if(functionName==='decimals')return 18;
      if(functionName==='symbol')return 'tNFIVE';
      throw Error('RPC_FAILED');
    }
  }));
  assert.equal(outcome.code,'TOKEN_BALANCE_READ_FAILED');
});
test('successful contract, native and token reads report ready',async()=>{
  const output=await diagnoseWalletRead(envWith(),'208627',client);
  assert.deepEqual(output,{ok:true,stage:'complete',code:'BALANCE_READ_OK'});
});
test('missing user wallet is not confused with RPC failure',async()=>{
  const db={prepare(){return{bind(){return{first:async()=>null}}}}};
  const output=await diagnoseWalletRead(envWith({DB:db}),'208627',client);
  assert.equal(output.code,'WALLET_NOT_FOUND');
});
