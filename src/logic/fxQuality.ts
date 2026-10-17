/** Cosmetic effect budgets; never alters shot travel, hit grading or timers. */
export type FxQuality = 'full' | 'low' | 'reduced';

export type FxBudget = {
  starsPerfect: number;
  starsGood: number;
  leafScale: number;
  projectileTrailStep: number;
  forestInsects: number;
  fallingLeaves: boolean;
};

export const FX_BUDGETS: Record<FxQuality, FxBudget> = {
  full: {
    starsPerfect: 14,
    starsGood: 9,
    leafScale: 1,
    projectileTrailStep: 0.14,
    forestInsects: 9,
    fallingLeaves: true,
  },
  low: {
    starsPerfect: 7,
    starsGood: 5,
    leafScale: 0.5,
    projectileTrailStep: 0.29,
    forestInsects: 4,
    fallingLeaves: false,
  },
  reduced: {
    starsPerfect: 0,
    starsGood: 0,
    leafScale: 0,
    projectileTrailStep: 2,
    forestInsects: 0,
    fallingLeaves: false,
  },
};

export function selectFxQuality(reducedMotion: boolean, lowPower: boolean): FxQuality {
  return reducedMotion ? 'reduced' : lowPower ? 'low' : 'full';
}

export function leafBudget(count: number, quality: FxQuality): number {
  return Math.max(0, Math.ceil(Math.max(0, count) * FX_BUDGETS[quality].leafScale));
}
