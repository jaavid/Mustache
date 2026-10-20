import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, randomBytes } from 'node:crypto';
import walletWorker from '../src/index.js';
import { unwrapKey } from '../src/security.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const SECRET = randomBytes(32).toString('base64');
const base = { WALLET_SERVICE_KEY:'internal-only', WALLET_ENCRYPTION_KEY:SECRET };
function dbMock() {
  const wallets = new Map();
  return {
    wallets,
    prepare(sql) {
      let args=[];
      return {
        bind(...value) { args=value; return this; },
        async first() {
          if(sql.startsWith('SELECT telegram_user_id,display_name,address FROM wallets WHERE telegram_user_id=?')) {
            const row=wallets.get(args[0]);
            return row ? {telegram_user_id:args[0],display_name:row.display_name,address:row.address}:null;
          }
          throw new Error('Unexpected query: '+sql);
        },
        async run() {
          if(sql.startsWith('INSERT OR IGNORE INTO wallets')) {
            if(!wallets.has(args[0])) wallets.set(args[0],{
              telegram_user_id:args[0],display_name:args[1],address:args[2],
              key_cipher:args[3],key_iv:args[4],created_at:args[5],
            });
            return {meta:{changes:1}};
          }
          throw new Error('Unexpected insert: '+sql);
        },
      };
    },
  };
}
function request({id='208627', key='internal-only', path='/internal/wallet/ensure', body={displayName:'Test Name'}}={}) {
  return new Request('https://wallet.internal'+path,{
    method:'POST',headers:{
      'x-wallet-service-key':key,'x-telegram-user-id':id,
      'content-type':'application/json',
    },body:JSON.stringify(body),
  });
}
test('verified internal bot route automatically persists an encrypted wallet',async()=>{
  const db=dbMock(),env={...base,DB:db};
  const res=await walletWorker.fetch(request(),env);
  assert.equal(res.status,201);
  const result=await res.json();
  assert.equal(result.telegramUserId,'208627');
  assert.equal(result.created,true);
  assert.match(result.address,/^0x[0-9a-f]{40}$/i);
  assert.equal(db.wallets.size,1);
  const stored=db.wallets.get('208627');
  assert.equal(stored.address,result.address);
  assert.match(stored.key_cipher,/^[a-zA-Z0-9+/=]+$/);
  const key=await unwrapKey(stored,'208627',SECRET);
  assert.match(key,/^0x[0-9a-f]{64}$/i);
  const plaintext=Buffer.from(key,'utf8');
  const ciphertext=Buffer.from(stored.key_cipher,'base64');
  // AES-GCM authenticates its payload with a 16-byte tag. Arbitrary
  // Base64 substrings (including "0x") are valid ciphertext and must not
  // be used to assert whether sensitive key material is encrypted.
  assert.equal(ciphertext.byteLength,plaintext.byteLength+16);
  assert.notDeepEqual(ciphertext,plaintext);
  assert.equal(Buffer.from(stored.key_iv,'base64').byteLength,12);
});
test('a second request never replaces the original address or encrypted key',async()=>{
  const db=dbMock(),env={...base,DB:db};
  const first=await (await walletWorker.fetch(request(),env)).json();
  const stored={...db.wallets.get('208627')};
  const second=await (await walletWorker.fetch(request({body:{displayName:'Another name'}}),env)).json();
  assert.equal(second.created,false);
  assert.equal(second.address,first.address);
  assert.deepEqual(db.wallets.get('208627'),stored);
});
test('rejects missing service secret and caller-supplied identity bypasses',async()=>{
  const db=dbMock(),env={...base,DB:db};
  const noKey=await walletWorker.fetch(request({key:'incorrect'}),env);
  assert.equal(noKey.status,401);
  const badUser=await walletWorker.fetch(request({id:'bad'}),env);
  assert.equal(badUser.status,400);
  assert.equal(db.wallets.size,0);
});
test('plaintext secret key not returned by internal route',async()=>{
  const db=dbMock(),env={...base,DB:db};
  const res=await walletWorker.fetch(request(),env);
  const text=await res.text();
  assert.equal(text.includes('key_cipher'),false);
  assert.equal(text.includes('key_iv'),false);
  assert.equal(text.includes('privateKey'),false);
});

test('read-only admin overview rejects wrong user ID and missing configuration',async()=>{
  const db=dbMock();
  const env={...base,DB:db,ADMIN_TELEGRAM_USER_ID:'208627'};
  const requestAdmin=(id)=>new Request('https://wallet.internal/internal/admin/overview',{
    method:'GET',headers:{'x-wallet-service-key':base.WALLET_SERVICE_KEY,'x-telegram-user-id':id}
  });
  const forbidden=await walletWorker.fetch(requestAdmin('42'),env);
  assert.equal(forbidden.status,403);
  const disabled=await walletWorker.fetch(requestAdmin('208627'),{...env,ADMIN_TELEGRAM_USER_ID:undefined});
  assert.equal(disabled.status,403);
});

test('operator-only detailed RPC checks reject other users even with correct service key',async()=>{
  const db=dbMock(),env={...base,DB:db,ADMIN_TELEGRAM_USER_ID:'208627'};
  const requestAs=id=>new Request('https://wallet.internal/internal/admin/diagnostics',{
    method:'GET',headers:{'x-wallet-service-key':base.WALLET_SERVICE_KEY,'x-telegram-user-id':id}
  });
  assert.equal((await walletWorker.fetch(requestAs('123'),env)).status,403);
  assert.equal((await walletWorker.fetch(requestAs('208627'),{
    ...env,ADMIN_TELEGRAM_USER_ID:undefined
  })).status,403);
  assert.equal((await walletWorker.fetch(new Request('https://wallet.internal/internal/admin/diagnostics',{
    headers:{'x-wallet-service-key':'bad-key','x-telegram-user-id':'208627'}
  }),env)).status,401);
});
