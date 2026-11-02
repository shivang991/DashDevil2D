/** Shared continuous, axis-aligned geometry. Tilt is presentation only. */
export interface Bounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}
/** Fraction of a linear motion segment at first strict contact; null for tangency.
 * Entry is the boundary time immediately preceding the nonempty overlap interval.
 * Callers own canonical time conversion and mode-specific contact consumption.
 */
export function firstContact(a0: Bounds, a1: Bounds, b0: Bounds, b1: Bounds): number | null {
  let entry = 0;
  let exit = 1;
  for (const [start, end] of [
    [a0.right - b0.left, a1.right - b1.left],
    [b0.right - a0.left, b1.right - a1.left],
    [a0.bottom - b0.top, a1.bottom - b1.top],
    [b0.bottom - a0.top, b1.bottom - a1.top],
  ]) {
    const change = end - start;
    if (change === 0) {
      if (start <= 0) return null;
    } else if (change > 0) entry = Math.max(entry, -start / change);
    else exit = Math.min(exit, -start / change);
  }
  return entry < exit && exit > 0 && entry < 1 ? entry : null;
}
