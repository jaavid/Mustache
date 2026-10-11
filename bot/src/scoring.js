/**
 * Recalculates points from individual impact geometry, never from client totals.
 * The browser still controls its visual target, so these checks are NOT sufficient
 * for cryptocurrency awards or fully anti-cheat competitive results.
 */
export function mondayUtc(ms) {
  const day = new Date(ms);
  const midnight = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  return midnight - ((day.getUTCDay() + 6) % 7) * 86400000;
}

export function verifyRoundShots(shots, portrait, clientScore) {
  if (!Array.isArray(shots) || shots.length > 80 || !Number.isInteger(clientScore) || clientScore < 0) {
    throw new Error('INVALID_ROUND');
  }
  const width = portrait ? 540 : 960;
  const low = portrait ? 369 : 125;
  const high = portrait ? 770 : 450;
  const lipYMin = portrait ? 365 : 175;
  const lipYMax = portrait ? 720 : 360;
  const radii = portrait ? [21, 15, 38, 26] : [17, 12, 33, 21];
  const variants = ['normal', 'sunglasses', 'round', 'headband', 'gold'];
  let score = 0;
  let combo = 0;
  let prevTime = -1;
  for (const shot of shots) {
    if (!shot || typeof shot !== 'object') throw new Error('INVALID_SHOT');
    const { tMs, aim, lip, variant, comboBefore } = shot;
    if (!Number.isInteger(tMs) || tMs < 0 || tMs > 46000 || tMs < prevTime) throw new Error('INVALID_TIMELINE');
    if (!aim || !lip || !variants.includes(variant)) throw new Error('INVALID_SHOT');
    const nums = [aim.x, aim.y, lip.x, lip.y];
    if (nums.some(n => typeof n !== 'number' || !Number.isFinite(n))) throw new Error('INVALID_COORDINATES');
    if (aim.x < 0 || aim.x > width || aim.y < low || aim.y > high) throw new Error('INVALID_AIM');
    if (lip.x < 0 || lip.x > width || lip.y < lipYMin || lip.y > lipYMax) throw new Error('INVALID_TARGET');
    if (!Number.isInteger(comboBefore) || comboBefore < 0 || comboBefore > combo) throw new Error('INVALID_COMBO');
    if (prevTime >= 0 && tMs - prevTime < 180) throw new Error('IMPOSSIBLE_SHOT_RATE');
    const dx = aim.x - lip.x, dy = aim.y - lip.y;
    const perfect = (dx / radii[0]) ** 2 + (dy / radii[1]) ** 2 <= 1;
    const good = (dx / radii[2]) ** 2 + (dy / radii[3]) ** 2 <= 1;
    combo = good ? comboBefore + 1 : 0;
    if (good) {
      score += (perfect ? 100 : 50) + Math.min(50, Math.max(0, combo - 1) * 10);
      if (variant === 'gold') score += 50;
      if (variant === 'sunglasses' && perfect) score += 25;
    }
    prevTime = tMs;
  }
  if (score !== clientScore || score > 15000) throw new Error('SCORE_MISMATCH');
  return { score, count: shots.length };
}
