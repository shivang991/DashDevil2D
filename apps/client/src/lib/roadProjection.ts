/** Never expose road beyond the guaranteed multiplayer generation horizon.
 * Use this scale for vertical positions and extents to preserve contact edges. */
export function multiplayerRoadScale(
  widthScale: number,
  height: number,
  generationAhead: number,
): number {
  return Math.max(widthScale, (height * 0.76) / generationAhead);
}
