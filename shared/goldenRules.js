/** Shared, deterministic collectible flight: exactly the same geometry in Phaser and the Worker.
 * Timings are active-round milliseconds (tutorial / pause time never counts).
 * A fixed schedule provides equal opportunity without trusting client-supplied targets.
 */
export const GOLDEN_SPAWN_MS = Object.freeze([7000, 14000, 21000, 28000, 35000]);
export const GOLDEN_FLIGHT_MS = 2500;
export const GOLDEN_REQUIRED = 3;
export const GOLDEN_PERFECT_BONUS = 350;
const MOBILE_LANES = [344, 368, 326, 358, 338];
const DESKTOP_LANES = [205, 227, 193, 220, 208];

/** Positions are computed, not reported by the browser, for score verification. */
export function goldenPosition(index, elapsedMs, portrait) {
  if (!Number.isInteger(index) || index < 0 || index >= GOLDEN_SPAWN_MS.length ||
      !Number.isFinite(elapsedMs)) return null;
  const offset = elapsedMs - GOLDEN_SPAWN_MS[index];
  if (offset < 0 || offset > GOLDEN_FLIGHT_MS) return null;
  const progress = offset / GOLDEN_FLIGHT_MS;
  const width = portrait ? 540 : 960;
  const leftToRight = index % 2 === 0;
  const x = leftToRight ? 65 + (width - 130) * progress : width - 65 - (width - 130) * progress;
  const lanes = portrait ? MOBILE_LANES : DESKTOP_LANES;
  return { x, y: lanes[index] - Math.sin(progress * Math.PI) * 18 };
}

/** Elliptical touch zone is generous enough for a finger but tied to the visible sprite. */
export function goldenHit(index, elapsedMs, aim, portrait) {
  const position = goldenPosition(index, elapsedMs, portrait);
  if (!position || !aim || !Number.isFinite(aim.x) || !Number.isFinite(aim.y)) return false;
  const rx = portrait ? 48 : 42;
  const ry = portrait ? 32 : 27;
  return ((aim.x - position.x) / rx) ** 2 + ((aim.y - position.y) / ry) ** 2 <= 1;
}
