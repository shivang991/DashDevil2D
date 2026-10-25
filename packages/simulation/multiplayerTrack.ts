import { createTrack, draw, selectCell, type RoadSlice } from "./track";
import type { MultiplayerConfiguration } from "./multiplayer";
/** Placement generation v1: chronological opportunities; reserved before random
 * at equal distance. Two draws per random opportunity even when suppressed,
 * one per reserved heart. First random anchor is clear distance + slice spacing. */
export class MultiplayerTrack {
  private readonly generator;
  private randomIndex = 1;
  private heartIndex = 1;
  private slices: RoadSlice[] = [];
  private through = 0;
  private readonly configuration: MultiplayerConfiguration;
  constructor(configuration: MultiplayerConfiguration, seed: number) {
    this.configuration = configuration;
    this.generator = createTrack(seed);
  }
  ensureThrough(distance: number): void {
    if (
      !Number.isFinite(distance) ||
      distance < 0 ||
      !Number.isSafeInteger(Math.ceil(distance * 1024))
    )
      throw new Error("Unrepresentable track coverage");
    const g = this.configuration.gameplay;
    const hearts =
      this.configuration.mode === "drag-race"
        ? (g as MultiplayerConfiguration["gameplay"] & { reservedHearts: number }).reservedHearts
        : 0;
    const finish =
      this.configuration.mode === "drag-race"
        ? (g as MultiplayerConfiguration["gameplay"] & { finishDistance: number }).finishDistance
        : Infinity;
    const limit = Math.min(distance, finish);
    while (true) {
      const randomDistance = g.initialClearDistance + this.randomIndex * g.sliceSpacing;
      const heartDistance =
        this.heartIndex <= hearts ? (this.heartIndex / (hearts + 1)) * finish : Infinity;
      const anchor = Math.min(randomDistance, heartDistance);
      if (anchor > limit || anchor >= finish) break;
      if (this.generator.nextId > 0xffffffff) throw new Error("Track identity exhausted");
      const cells: [
        "empty" | "coin" | "obstacle" | "heart",
        "empty" | "coin" | "obstacle" | "heart",
        "empty" | "coin" | "obstacle" | "heart",
      ] = ["empty", "empty", "empty"];
      if (heartDistance <= randomDistance) {
        cells[Math.floor(draw(this.generator) * 3)] = "heart";
        this.heartIndex++;
      } else {
        const { lane, cell } = selectCell(g, () => draw(this.generator));
        // A nearby reserved center can be found arithmetically, independent of chunk size.
        const index = Math.max(
          1,
          Math.min(hearts, Math.floor((anchor / finish) * (hearts + 1) + 0.5)),
        );
        const reservedDistance = (index / (hearts + 1)) * finish;
        const reserved =
          hearts > 0 &&
          (anchor === reservedDistance ||
            (cell === "obstacle" &&
              Math.abs(anchor - reservedDistance) <=
                (g as typeof g & { heartExclusionDistance: number }).heartExclusionDistance));
        if (!reserved) cells[lane] = cell;
        this.randomIndex++;
      }
      this.slices.push({ id: this.generator.nextId++, distance: anchor, timeUs: 0, cells });
    }
    this.through = Math.max(this.through, limit);
  }
  /** Placement retirement follows the trailing car, preserving two independent windows. */
  retireBehind(distance: number): void {
    const g = this.configuration.gameplay;
    const extent = Math.max(g.obstacleH, g.coinSize, g.heartSize) / 2;
    this.slices = this.slices.filter((slice) => slice.distance + extent >= distance);
  }
  snapshot() {
    return {
      randomState: this.generator.randomState,
      nextId: this.generator.nextId,
      randomIndex: this.randomIndex,
      heartIndex: this.heartIndex,
      through: this.through,
      slices: this.slices.map((slice) => ({
        ...slice,
        cells: [...slice.cells] as RoadSlice["cells"],
      })),
    };
  }
}
