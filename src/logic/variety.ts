import type { Grade } from './scoring';

/** Character appearance percentages: 55 / 18 / 12 / 10 / 5. */
export const RAMIN_VARIANTS = ['normal', 'sunglasses', 'round', 'headband', 'gold'] as const;
export type RaminVariant = (typeof RAMIN_VARIANTS)[number];
export type SpawnEvent = 'normal' | 'fake-out' | 'double';

export function chooseRaminVariant(random: number): RaminVariant {
  const roll = Math.min(.999999999, Math.max(0, random));
  if (roll < .55) return 'normal';
  if (roll < .73) return 'sunglasses';
  if (roll < .85) return 'round';
  if (roll < .95) return 'headband';
  return 'gold';
}

/** Special events become available six seconds in and stop six seconds before time-up.
 * The fake-out cannot penalize combos and never repeats immediately.
 */
export function chooseSpawnEvent(elapsed: number, remaining: number, random: number, previous: SpawnEvent): SpawnEvent {
  if (elapsed < 6 || remaining <= 6) return 'normal';
  const roll = Math.min(.999999999, Math.max(0, random));
  if (roll < .07 && previous !== 'fake-out') return 'fake-out';
  if (roll >= .07 && roll < .19 && previous !== 'double') return 'double';
  return 'normal';
}

export type VariantReward = { bonus: number; label: string };
export function variantReward(variant: RaminVariant, grade: Grade): VariantReward {
  if (grade === 'miss') return { bonus: 0, label: '' };
  if (variant === 'gold') return { bonus: 50, label: 'GOLD +50' };
  if (variant === 'sunglasses' && grade === 'perfect') return { bonus: 25, label: 'COOL +25' };
  return { bonus: 0, label: '' };
}
