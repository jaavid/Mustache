// All arithmetic uses bigint; do not round ERC-20 token values with Number.
export function telegramId(value) {
  const id = String(value ?? '');
  if (!/^[1-9][0-9]{0,18}$/.test(id)) throw new Error('INVALID_TELEGRAM_ID');
  return id;
}
export function tokenRaw(value, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('INVALID_DECIMALS');
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) throw new Error('INVALID_AMOUNT');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new Error('INVALID_PRECISION');
  const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (raw <= 0n || raw >= 2n ** 256n) throw new Error('INVALID_AMOUNT');
  return raw;
}
export function batchPlan(allocations, decimals, maximum) {
  if (!Array.isArray(allocations) || allocations.length < 1 || allocations.length > 100) throw new Error('INVALID_ALLOCATIONS');
  const seen = new Set();
  const items = allocations.map(row => {
    const id = telegramId(row?.telegramUserId);
    if (seen.has(id)) throw new Error('DUPLICATE_PLAYER');
    seen.add(id);
    return { id, raw: tokenRaw(row?.amount, decimals).toString() };
  }).sort((a,b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
  const sum = items.reduce((n,i) => n + BigInt(i.raw), 0n);
  if (sum > tokenRaw(maximum, decimals)) throw new Error('BATCH_OVER_BUDGET');
  return { items, sum: sum.toString() };
}
// Split pool: 40% equally for eligible players; 60% by descending rank weight.
// Deterministic largest-remainder apportionment with numeric ID tie-breaking.
export function rankRewards(rankedIds, poolRaw) {
  if (!Array.isArray(rankedIds) || rankedIds.length < 1 || rankedIds.length > 100) throw new Error('INVALID_RANKING');
  const ids = rankedIds.map(telegramId);
  if (new Set(ids).size !== ids.length) throw new Error('DUPLICATE_PLAYER');
  const pool = BigInt(poolRaw);
  if (pool <= 0n) throw new Error('INVALID_POOL');
  const n = BigInt(ids.length);
  const weights = n * (n + 1n) / 2n;
  const basePool = pool * 40n / 100n;
  const competitive = pool - basePool;
  const values = ids.map((id, i) => {
    const weight = n - BigInt(i);
    const base = basePool / n;
    return { id, raw: base + competitive * weight / weights, remainder: competitive * weight % weights };
  });
  let left = pool - values.reduce((s, x) => s + x.raw, 0n);
  const order = [...values].sort((a,b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : ids.indexOf(a.id)-ids.indexOf(b.id));
  for (let k=0; left>0n; k++,left--) order[k%order.length].raw += 1n;
  return values.map(v => ({ id:v.id, raw:v.raw.toString() }));
}
// Iran does not observe daylight saving time since 2022. UTC+03:30.
export function completedTehranWeek(nowMs) {
  const offset = 210 * 60_000;
  const local = new Date(nowMs + offset);
  const daysSinceSaturday = (local.getUTCDay() + 1) % 7;
  const thisSaturday = Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()-daysSinceSaturday) - offset;
  return { start: thisSaturday - 7*86_400_000, end: thisSaturday };
}
export function safeBatchId(s) {
  if (typeof s !== 'string' || !/^[a-zA-Z0-9_-]{3,75}$/.test(s)) throw new Error('INVALID_BATCH_ID');
  return s;
}
