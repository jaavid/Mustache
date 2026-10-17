import { FX_BUDGETS, selectFxQuality, type FxBudget } from '../logic/fxQuality';
import { reduceVisualMotion } from './motionPrefs';

/** Conservative hardware hints; no User-Agent sniffing or device tracking.
 * A reduced-motion preference takes precedence over frame-rate heuristics.
 */
export function fxBudget(): FxBudget {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  const memoryGB = (nav as (Navigator & { deviceMemory?: number }) | null)?.deviceMemory;
  const lowPower =
    !!nav &&
    ((typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) ||
      (typeof memoryGB === 'number' && memoryGB <= 4));
  return FX_BUDGETS[selectFxQuality(reduceVisualMotion(), lowPower)];
}
