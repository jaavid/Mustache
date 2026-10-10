export type Grade = 'perfect' | 'good' | 'miss';
export type ShotResult = { grade: Grade; points: number; combo: number; distance: number };

/** Screen-space evaluation; coordinates must use Phaser's logical 960x540 canvas. */
export function evaluateShot(distance: number, currentCombo: number, isTargetVisible: boolean): ShotResult {
  if (!isTargetVisible || !Number.isFinite(distance) || distance > 43) {
    return { grade: 'miss', points: 0, combo: 0, distance };
  }
  const combo = currentCombo + 1;
  const base = distance <= 19 ? 100 : 50;
  // Capped streak bonus: neither spam nor clicking an inactive target earns points.
  const bonus = Math.min(50, Math.max(0, combo - 1) * 10);
  return { grade: base === 100 ? 'perfect' : 'good', points: base + bonus, combo, distance };
}

export const ROUND_LENGTH_SECONDS = 45;
export const BEST_SCORE_KEY = 'n5-mustache-mayhem-best-v1';

export function readBestScore(): number {
  try {
    const score = Number(localStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(score) && score >= 0 ? score : 0;
  } catch {
    return 0;
  }
}
export function saveBestScore(score: number): void {
  try { localStorage.setItem(BEST_SCORE_KEY, String(Math.max(0, Math.floor(score)))); } catch { /* storage optional */ }
}
