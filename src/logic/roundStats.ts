import type { Grade } from './scoring';

export type RoundStats = Readonly<{
  shots: number;
  hits: number;
  perfect: number;
  good: number;
  misses: number;
  maxCombo: number;
}>;
export type Medal = 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD';
export type RoundSummary = RoundStats & { accuracy: number; medal: Medal };
export const emptyStats: RoundStats = Object.freeze({
  shots: 0,
  hits: 0,
  perfect: 0,
  good: 0,
  misses: 0,
  maxCombo: 0,
});

/** Call exactly once when a projectile reaches its target. */
export function recordShot(stats: RoundStats, grade: Grade, combo: number): RoundStats {
  const hit = grade !== 'miss';
  return {
    shots: stats.shots + 1,
    hits: stats.hits + (hit ? 1 : 0),
    perfect: stats.perfect + (grade === 'perfect' ? 1 : 0),
    good: stats.good + (grade === 'good' ? 1 : 0),
    misses: stats.misses + (hit ? 0 : 1),
    maxCombo: Math.max(stats.maxCombo, Math.max(0, Math.floor(combo))),
  };
}
export function accuracyPercent(stats: RoundStats): number {
  return stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
}
export function calculateMedal(score: number, accuracy: number): Medal {
  if (score >= 1700 && accuracy >= 70) return 'GOLD';
  if (score >= 950 && accuracy >= 50) return 'SILVER';
  if (score >= 350) return 'BRONZE';
  return 'NONE';
}
export function summarizeRound(stats: RoundStats, score: number): RoundSummary {
  const accuracy = accuracyPercent(stats);
  return { ...stats, accuracy, medal: calculateMedal(score, accuracy) };
}
