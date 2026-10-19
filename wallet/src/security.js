// Testnet custody only. NEVER expose cleartext keys or ciphertext in APIs/logs.
const encode = value => btoa(String.fromCharCode(...value));
const decode = value => Uint8Array.from(atob(value), c=>c.charCodeAt(0));
async function keyFromSecret(secret) {
  const bytes=decode(secret||'');
  if (bytes.length !== 32) throw new Error('INVALID_ENCRYPTION_KEY');
  return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
}
export async function wrapKey(privateKey, userId, secret) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await keyFromSecret(secret);
  const aad=new TextEncoder().encode('n5-amoy-wallet-v1:'+userId);
  const cipher=await crypto.subtle.encrypt({ name:'AES-GCM',iv,additionalData:aad },key,new TextEncoder().encode(privateKey));
  return { cipher:encode(new Uint8Array(cipher)),iv:encode(iv) };
}
export async function unwrapKey(row, userId, secret) {
  const key=await keyFromSecret(secret);
  const aad=new TextEncoder().encode('n5-amoy-wallet-v1:'+userId);
  const raw=await crypto.subtle.decrypt({ name:'AES-GCM',iv:decode(row.key_iv),additionalData:aad },key,decode(row.key_cipher));
  return new TextDecoder().decode(raw);
}
export function tokenEqual(actual,expected) {
  if (!actual || !expected) return false;
  const a=new TextEncoder().encode(actual), b=new TextEncoder().encode(expected);
  let d=a.length ^ b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++) d |= (a[i]||0)^(b[i]||0);
  return d===0;
}
export async function sha256(s) {
  const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
