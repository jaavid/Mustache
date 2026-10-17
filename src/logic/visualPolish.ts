/** Purely visual choreography: no hitbox, input or scoring changes. */
export const PHASE_TOAST_MS = 720;
export const PHASE_TOAST = {
  portrait: { y: 319, width: 342, height: 43, fontSize: 19, rise: 12 },
  landscape: { y: 212, width: 425, height: 43, fontSize: 21, rise: 12 },
} as const;

export function shouldAccentPerfectStreak(perfect: boolean, combo: number): boolean {
  return perfect && Number.isFinite(combo) && combo >= 5;
}
