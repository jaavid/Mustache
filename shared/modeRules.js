/** Shared, deterministic Gold Rush scoring on both client and Worker. */
export function goldRushShotBonus(grade, consecutivePerfects) {
  if (grade !== 'perfect') return 0;
  return 50 + (consecutivePerfects > 0 && consecutivePerfects % 3 === 0 ? 150 : 0);
}
