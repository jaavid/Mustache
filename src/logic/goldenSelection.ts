/** One-use golden charge is equipped only by explicit selection of slot 2.
 * A previously-selected slot 2 must NOT auto-arm when the third pickup lands.
 */
export const GOLDEN_SELECTOR_INDEX = 1;

export function armGoldenForSelection(style: number, ready: boolean): boolean {
  return style === GOLDEN_SELECTOR_INDEX && ready;
}

export function shouldLaunchGolden(
  style: number,
  armed: boolean,
  ready: boolean,
): boolean {
  return style === GOLDEN_SELECTOR_INDEX && armed && ready;
}
