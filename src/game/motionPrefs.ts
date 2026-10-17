/** Prevent decorative animation for users who request reduced motion. */
export function reduceVisualMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}
