import { evaluateAim, type AimPoint, type ShotResult } from './scoring';
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
}>;

export type ResolvedShot = Readonly<{
  result: ShotResult;
  reward: VariantReward;
  gained: number;
  score: number;
  combo: number;
  stats: RoundStats;
}>;

export function resolveRoundShot(context: ShotContext): ResolvedShot {
  const result = evaluateAim(
    context.aim,
    context.lip,
    context.combo,
    true,
    context.portrait,
  );
  const reward = variantReward(context.variant, result.grade);
  const gained = result.points + reward.bonus;

  return {
    result,
    reward,
    gained,
    score: context.score + gained,
    combo: result.combo,
    stats: recordShot(context.stats, result.grade, result.combo),
  };
}
