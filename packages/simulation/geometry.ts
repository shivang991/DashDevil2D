/** Shared continuous, axis-aligned geometry. Tilt is presentation only. */
export interface Bounds { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number }
export function laneCenter(lane: number, width: number, roadRatio: number, count: number): number {
  return (width - width * roadRatio) / 2 + width * roadRatio / count * (lane + 0.5);
}
export function overlaps(a: Bounds, b: Bounds): boolean {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
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
    if (change === 0) { if (start <= 0) return null; }
    else if (change > 0) entry = Math.max(entry, -start / change);
    else exit = Math.min(exit, -start / change);
  }
  return entry < exit && exit > 0 && entry < 1 ? entry : null;
}
export interface Contact { readonly time: number; readonly kind: 'coin' | 'obstacle'; readonly id: number }
export function chronologicalContacts<T extends Contact>(contacts: readonly T[]): T[] {
  return [...contacts].sort((a, b) => a.time - b.time || (a.kind === b.kind ? a.id - b.id : a.kind === 'coin' ? -1 : 1));
}
