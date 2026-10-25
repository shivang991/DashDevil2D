import type { GameConfig } from "./config";

export type Cell = "empty" | "coin" | "obstacle" | "heart";
export interface RoadSlice {
  readonly id: number;
  readonly distance: number;
  readonly timeUs: number;
  readonly cells: readonly [Cell, Cell, Cell];
}
export interface Track {
  readonly version: 1;
  readonly seed: number;
  randomState: number;
  nextId: number;
  slices: RoadSlice[];
  consumed: Set<number>;
}
export function createTrack(seed: number): Track {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff)
    throw new Error("Seed must be a nonzero uint32");
  return { version: 1, seed, randomState: seed, nextId: 1, slices: [], consumed: new Set() };
}
/** xorshift32 (13,17,5), advance before return. No decorative draws. */
export function draw(track: Track): number {
  let word = track.randomState;
  word ^= word << 13;
  word ^= word >>> 17;
  word ^= word << 5;
  track.randomState = word >>> 0;
  return track.randomState / 0x100000000;
}
/** Exactly two draws per opportunity, including empty cells: lane, then type. */
export function appendSlice(
  track: Track,
  progress: number,
  config: GameConfig,
  timeUs: number,
  random = () => draw(track),
): RoadSlice {
  if (!Number.isSafeInteger(track.nextId)) throw new Error("Object identity exhausted");
  const { lane, cell } = selectCell(config, random);
  const size =
    cell === "obstacle" ? config.obstacleH : cell === "heart" ? config.heartSize : config.coinSize;
  const cells: [Cell, Cell, Cell] = ["empty", "empty", "empty"];
  cells[lane] = cell;
  // Original 806px reference view: car center 726, spawn top -objectHeight.
  // This fixed world anchor never depends on the current viewport.
  const slice = Object.freeze({
    id: track.nextId++,
    timeUs,
    distance: progress + 806 - config.carBottomMargin - config.carHeight / 2 + size / 2,
    cells: Object.freeze(cells),
  });
  track.slices.push(slice);
  return slice;
}
export function retireSlices(track: Track, behind: number, config: GameConfig): void {
  const extent = Math.max(config.obstacleH, config.coinSize, config.heartSize) / 2;
  // Strictly behind all reachable car bounds, including acceleration release.
  const retired = track.slices.filter((slice) => slice.distance + extent < behind);
  track.slices = track.slices.filter((slice) => slice.distance + extent >= behind);
  for (const slice of retired) track.consumed.delete(slice.id);
}

/** Generation-v1 draw order shared by local and multiplayer tracks. */
export function selectCell(
  config: Pick<GameConfig, "coinWeight" | "obstacleWeight" | "heartWeight" | "emptyWeight">,
  random: () => number,
): { lane: number; cell: Cell } {
  const lane = Math.floor(random() * 3);
  const total = config.coinWeight + config.obstacleWeight + config.heartWeight + config.emptyWeight;
  const selection = random() * total;
  const cell: Cell =
    selection < config.coinWeight
      ? "coin"
      : selection < config.coinWeight + config.obstacleWeight
        ? "obstacle"
        : selection < config.coinWeight + config.obstacleWeight + config.heartWeight
          ? "heart"
          : "empty";
  return { lane, cell };
}
