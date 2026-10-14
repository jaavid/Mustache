import type { GameMode } from './gameMode';

export type Grade = 'perfect' | 'good' | 'miss';
export type ShotResult = { grade: Grade; points: number; combo: number; distance: number };

/** The lip is a horizontal target, not a generous circle around the face.
 * These physical pixel radii are shared by visual feedback and scoring.
 * Mobile gets a deliberately modest allowance for finger occlusion.
 */
export const AIM_ZONES = {
  desktop: { perfectX: 17, perfectY: 12, goodX: 33, goodY: 21 },
  mobile: { perfectX: 21, perfectY: 15, goodX: 38, goodY: 26 },
} as const;
export type AimPoint = Readonly<{ x: number; y: number }>;
export function inLipEllipse(aim: AimPoint, lip: AimPoint, rx: number, ry: number): boolean {
  if (
    !Number.isFinite(aim.x) ||
    !Number.isFinite(aim.y) ||
    !Number.isFinite(lip.x) ||
    !Number.isFinite(lip.y)
  )
    return false;
  const dx = (aim.x - lip.x) / rx,
    dy = (aim.y - lip.y) / ry;
  return dx * dx + dy * dy <= 1;
}
/** Authoritative client-side shot grade. Both landing visuals and this test
 * use the same aim point; there is no hidden auto-correction of touch input.
 */
export function evaluateAim(
  aim: AimPoint,
  lip: AimPoint,
  currentCombo: number,
  visible: boolean,
  portrait = false,
): ShotResult {
  const dx = aim.x - lip.x,
    dy = aim.y - lip.y;
  const distance = Math.hypot(dx, dy);
  const zones = portrait ? AIM_ZONES.mobile : AIM_ZONES.desktop;
  if (!visible || !Number.isFinite(distance) || !inLipEllipse(aim, lip, zones.goodX, zones.goodY))
    return { grade: 'miss', points: 0, combo: 0, distance };
  const perfect = inLipEllipse(aim, lip, zones.perfectX, zones.perfectY);
  const combo = currentCombo + 1;
  return {
    grade: perfect ? 'perfect' : 'good',
    points: (perfect ? 100 : 50) + Math.min(50, Math.max(0, combo - 1) * 10),
    combo,
    distance,
  };
}

export const ROUND_LENGTH_SECONDS = 45;
export const BEST_SCORE_KEY = 'n5-mustache-mayhem-best-v1';

function bestKey(mode: GameMode): string {
  return mode === 'goldRush' ? BEST_SCORE_KEY + '-gold-rush' : BEST_SCORE_KEY;
}

export function readBestScore(mode: GameMode = 'classic'): number {
  try {
    const score = Number(localStorage.getItem(bestKey(mode)));
    return Number.isFinite(score) && score >= 0 ? score : 0;
  } catch {
    return 0;
  }
}
export function saveBestScore(score: number, mode: GameMode = 'classic'): void {
  try {
    localStorage.setItem(bestKey(mode), String(Math.max(0, Math.floor(score))));
  } catch {
    /* storage optional */
  }
}
