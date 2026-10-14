import { evaluateAim, type AimPoint, type ShotResult } from './scoring';
import { GOLDEN_PERFECT_BONUS } from '../../shared/goldenRules.js';
import { goldRushShotBonus } from '../../shared/modeRules.js';
import type { GameMode } from './gameMode';
import { recordShot, type RoundStats } from './roundStats';
import { variantReward, type RaminVariant, type VariantReward } from './variety';

/** One scoring transaction shared by desktop and portrait scenes.
 *
 * Both callers calculate the lip point at projectile impact, then apply this
 * result exactly once. Visual effects never alter the grade or score.
 */
export type ShotContext = Readonly<{
  aim: AimPoint;
  lip: AimPoint;
  score: number;
  combo: number;
  stats: RoundStats;
  variant: RaminVariant;
  portrait: boolean;
  /** One-use special projectile awarded after three validated pickups. */
  goldenShot?: boolean;
  mode?: GameMode;
  perfectStreakBefore?: number;
}>;

export type ResolvedShot = Readonly<{
  result: ShotResult;
  reward: VariantReward;
  gained: number;
  goldenPerfect: boolean;
  goldRushBonus: number;
  perfectStreak: number;
  score: number;
  combo: number;
  stats: RoundStats;
}>;

export function resolveRoundShot(context: ShotContext): ResolvedShot {
  const result = evaluateAim(context.aim, context.lip, context.combo, true, context.portrait);
  const reward = variantReward(context.variant, result.grade);
  const goldenPerfect = context.goldenShot === true && result.grade === 'perfect';
  const perfectStreak = result.grade === 'perfect' ? (context.perfectStreakBefore || 0) + 1 : 0;
  const goldRushBonus =
    context.mode === 'goldRush' ? goldRushShotBonus(result.grade, perfectStreak) : 0;
  const gained =
    result.points + reward.bonus + (goldenPerfect ? GOLDEN_PERFECT_BONUS : 0) + goldRushBonus;

  return {
    result,
    reward,
    gained,
    goldenPerfect,
    goldRushBonus,
    perfectStreak,
    score: context.score + gained,
    combo: result.combo,
    stats: recordShot(context.stats, result.grade, result.combo),
  };
}
