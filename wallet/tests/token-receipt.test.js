import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAbi,encodeFunctionData,encodeEventTopics,encodeAbiParameters} from 'viem';
import {tokenAbi,hasConfirmedTokenTransfer} from '../src/chain.js';

const sender='0x'+'1'.repeat(40),recipient='0x'+'2'.repeat(40);
const outsider='0x'+'3'.repeat(40),contract='0x'+'4'.repeat(40);
const transferAbi=parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);
function job(dest=recipient,amount=100n) {
  return {
    kind:'TOKEN',sender,target:contract,
    call_data:encodeFunctionData({
      abi:tokenAbi,functionName:'transfer',args:[dest,amount],
    }),
  };
}
function receipt(from=sender,to=recipient,value=100n,token=contract) {
  return {status:'success',logs:[{
    address:token,topics:encodeEventTopics({
      abi:transferAbi,eventName:'Transfer',args:{from,to},
    }),
    data:encodeAbiParameters([{type:'uint256'}],[value]),
  }]};
}
test('ERC-20 transaction receipt requires matching contract, sender, recipient and raw token amount',()=>{
  assert.equal(hasConfirmedTokenTransfer(job(),receipt()),true);
  assert.equal(hasConfirmedTokenTransfer(job(),receipt(sender,recipient,99n)),false);
  assert.equal(hasConfirmedTokenTransfer(job(),receipt(sender,outsider)),false);
  assert.equal(hasConfirmedTokenTransfer(job(),receipt(outsider,recipient)),false);
  assert.equal(hasConfirmedTokenTransfer(job(),receipt(sender,recipient,100n,outsider)),false);
  assert.equal(hasConfirmedTokenTransfer(job(),{status:'success',logs:[]}),false);
  assert.equal(hasConfirmedTokenTransfer(job(),{status:'success',logs:[{address:contract,data:'0x',topics:[]}]}),false);
});
test('gas transfers are native POL and do not require ERC-20 events',()=>{
  assert.equal(hasConfirmedTokenTransfer({kind:'GAS'}, {logs:[]}),true);
});
