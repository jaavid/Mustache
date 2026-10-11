import { describe, expect, it } from 'vitest';
import { armGoldenForSelection, shouldLaunchGolden } from '../goldenSelection';

describe('manual golden slot selection', () => {
  it('does not arm when slot 2 was selected before the third pickup', () => {
    const selected = 1;
    let armed = armGoldenForSelection(selected, false);
    expect(armed).toBe(false);
    const ready = true; // Collecting the third flyer does not call selectStyle().
    expect(shouldLaunchGolden(selected, armed, ready)).toBe(false);
    armed = armGoldenForSelection(1, ready); // An explicit tap / key 2.
    expect(shouldLaunchGolden(selected, armed, ready)).toBe(true);
  });

  it('preserves a charge while shooting styles 1 or 3, and allows re-equipping gold', () => {
    const ready = true;
    expect(shouldLaunchGolden(0, armGoldenForSelection(0, ready), ready)).toBe(false);
    expect(shouldLaunchGolden(2, armGoldenForSelection(2, ready), ready)).toBe(false);
    expect(shouldLaunchGolden(1, armGoldenForSelection(1, ready), ready)).toBe(true);
    expect(shouldLaunchGolden(1, true, false)).toBe(false); // charge consumed
  });
});
