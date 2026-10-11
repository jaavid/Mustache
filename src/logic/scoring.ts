export type Grade = 'perfect' | 'good' | 'miss';
export type ShotResult = { grade: Grade; points: number; combo: number; distance: number };

/** Screen-space evaluation; coordinates must use Phaser's logical 960x540 canvas. */
export function evaluateShot(
  distance: number,
  currentCombo: number,
  isTargetVisible: boolean,
): ShotResult {
  if (!isTargetVisible || !Number.isFinite(distance) || distance > 43) {
    return { grade: 'miss', points: 0, combo: 0, distance };
  }
  const combo = currentCombo + 1;
  const base = distance <= 19 ? 100 : 50;
  // Capped streak bonus: neither spam nor clicking an inactive target earns points.
  const bonus = Math.min(50, Math.max(0, combo - 1) * 10);
  return { grade: base === 100 ? 'perfect' : 'good', points: base + bonus, combo, distance };
}

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

export function readBestScore(): number {
  try {
    const score = Number(localStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(score) && score >= 0 ? score : 0;
  } catch {
    return 0;
  }
}
export function saveBestScore(score: number): void {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(Math.max(0, Math.floor(score))));
  } catch {
    /* storage optional */
  }
}
