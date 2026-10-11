const KEY = 'n5-haptics-enabled-v1';
let enabled = false; // Opt-in: never vibrate without an explicit choice.
try {
  enabled = localStorage.getItem(KEY) === 'true';
} catch {
  /* optional */
}
export type HapticEvent = 'perfect' | 'good' | 'miss' | 'select';
export function hapticsEnabled(): boolean {
  return enabled;
}
export function toggleHaptics(): boolean {
  enabled = !enabled;
  try {
    localStorage.setItem(KEY, String(enabled));
  } catch {
    /* optional */
  }
  return enabled;
}
/** Unsupported browsers and devices simply do nothing. */
export function haptic(event: HapticEvent): void {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function')
    return;
  const patterns: Record<HapticEvent, number | number[]> = {
    perfect: [18, 32, 30],
    good: 18,
    miss: 8,
    select: 7,
  };
  try {
    navigator.vibrate(patterns[event]);
  } catch {
    /* optional */
  }
}
