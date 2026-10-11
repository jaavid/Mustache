/**
 * Phaser Scene.update is suspended while the scene is paused (guide, menu,
 * app visibility). Game-loop time.now is NOT a valid competitive round timer.
 */
export function accumulateActiveRoundMs(elapsedMs: number, activeFrameDeltaMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError('Invalid elapsed time');
  if (!Number.isFinite(activeFrameDeltaMs) || activeFrameDeltaMs < 0) return elapsedMs;
  return elapsedMs + activeFrameDeltaMs;
}
