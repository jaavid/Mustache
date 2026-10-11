import { describe, expect, it } from 'vitest';
import { accumulateActiveRoundMs } from '../activeRoundClock';

describe('active competitive round clock', () => {
  it('counts only active Phaser updates, not gaps spent in tutorial or pause', () => {
    let elapsed = 0;
    elapsed = accumulateActiveRoundMs(elapsed, 6000);
    // User spends 4 minutes reading the tutorial; the paused scene gets no updates.
    elapsed = accumulateActiveRoundMs(elapsed, 13000);
    // User pauses again for 2 minutes. The competitive clock stays at 19 seconds.
    elapsed = accumulateActiveRoundMs(elapsed, 26000);
    expect(elapsed).toBe(45000);
  });
  it('ignores invalid frame deltas and enforces valid clock state', () => {
    expect(accumulateActiveRoundMs(350, -1)).toBe(350);
    expect(accumulateActiveRoundMs(350, Number.NaN)).toBe(350);
    expect(() => accumulateActiveRoundMs(-1, 16)).toThrow();
  });
});
