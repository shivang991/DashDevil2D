/** Stretch the clear road ahead on tall displays, keeping sprite sizes and
 * contact edges unchanged. World generation and collision timing stay fixed. */
export function longDriveObjectY(
  distanceAhead: number,
  objectHeight: number,
  carY: number,
  carHeight: number,
  carYBase: number,
  referenceCarY: number,
): number {
  const gap = Math.max(0, distanceAhead - (carHeight + objectHeight) / 2);
  const offset = carYBase - carY;
  const scale = Math.max(1, carY / Math.max(1, referenceCarY - offset));
  return carY + carHeight / 2 - distanceAhead - objectHeight / 2 - gap * (scale - 1);
}

/** Never expose road beyond the guaranteed multiplayer generation horizon.
 * Use this scale for vertical positions and extents to preserve contact edges. */
export function multiplayerRoadScale(
  widthScale: number,
  height: number,
  generationAhead: number,
): number {
  return Math.max(widthScale, (height * 0.76) / generationAhead);
}
