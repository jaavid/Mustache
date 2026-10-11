import { describe, expect, it } from 'vitest';
import {
  MOMENT_COOLDOWN_MS,
  momentReady,
  selectSpawnMoment,
  selectHitMoment,
  selectExitMoment,
} from '../moments';
describe('Ramin moment direction and fairness', () => {
  it('applies a scene-time cooldown for any consecutive moments', () => {
    expect(momentReady(5000, 5000 - MOMENT_COOLDOWN_MS)).toBe(true);
    expect(momentReady(5000, 2000)).toBe(false);
    expect(momentReady(Number.NaN, 0)).toBe(false);
  });
  it('only adjusts glasses if the selected Ramin wears them', () => {
    expect(selectSpawnMoment('sunglasses', 0.08, 10000, 0)).toBe('glasses-adjust');
    expect(selectSpawnMoment('round', 0.18, 10000, 0)).toBe('glasses-adjust');
    expect(selectSpawnMoment('normal', 0.08, 10000, 0)).toBe('serious');
    expect(selectSpawnMoment('headband', 0.16, 10000, 0)).toBe('taunt');
    expect(selectSpawnMoment('sunglasses', 0.08, 12000, 11000)).toBe(null);
    expect(selectSpawnMoment('normal', 0.9, 10000, 0)).toBe(null);
  });
  it('never grants a hit moment on a miss, good, or too-early perfect', () => {
    expect(selectHitMoment('miss', 10, 0, 10000, 0)).toBe(null);
    expect(selectHitMoment('good', 10, 0, 10000, 0)).toBe(null);
    expect(selectHitMoment('perfect', 1, 0, 10000, 0)).toBe(null);
    expect(selectHitMoment('perfect', 4, 0.1, 10000, 0)).toBe('touch');
    expect(selectHitMoment('perfect', 4, 0.1, 9000, 7000)).toBe(null);
  });
  it('selects rare slip only after the target is inactive', () => {
    expect(selectExitMoment(0.1, 10000, 0)).toBe('slip');
    expect(selectExitMoment(0.8, 10000, 0)).toBe(null);
    expect(selectExitMoment(0.1, 10000, 9000)).toBe(null);
  });
});
