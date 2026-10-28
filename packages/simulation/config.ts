import { CounterMax } from "@dashdevil/contracts/protocol";
import defaults from "@dashdevil/contracts/configuration";
import { configurationResources } from "@dashdevil/contracts/validation";

// JSON is the language-neutral source; freeze it before any capture uses it.
function freezeDefinition(value: object): void {
  for (const child of Object.values(value))
    if (typeof child === "object" && child !== null) freezeDefinition(child);
  Object.freeze(value);
}
freezeDefinition(defaults);

type Numeric<T> = { readonly [K in keyof T]: number };
export type Mode = keyof typeof defaults.gameplay;
export type GameplayConfig<M extends Mode = "long-drive"> = Numeric<(typeof defaults.gameplay)[M]>;
export type PresentationConfig = Numeric<typeof defaults.presentation>;
export type RoomConfig = Numeric<typeof defaults.room>;
export type ConnectionConfig = Numeric<typeof defaults.connection>;
export type OperationalConfig = Numeric<typeof defaults.operational>;
export interface ConfigurationOverrides<M extends Mode = "long-drive"> {
  gameplay?: Partial<GameplayConfig<M>>;
  presentation?: Partial<PresentationConfig>;
  room?: Partial<RoomConfig>;
  connection?: Partial<ConnectionConfig>;
  operational?: Partial<OperationalConfig>;
}
export interface Configuration<M extends Mode = "long-drive"> {
  readonly version: number;
  readonly mode: M;
  readonly gameplay: GameplayConfig<M>;
  readonly presentation: PresentationConfig;
  readonly room: RoomConfig;
  readonly connection: ConnectionConfig;
  readonly operational: OperationalConfig;
}
export class ConfigurationError extends Error {
  readonly field: string;
  constructor(field: string, reason: string) {
    super(`${field}: ${reason}`);
    this.name = "ConfigurationError";
    this.field = field;
  }
}
function requireValue(condition: boolean, field: string, reason: string): void {
  if (!condition) throw new ConfigurationError(field, reason);
}
const integerFields = new Set([
  "maxHealth",
  "obstacleDamage",
  "playerContactDamage",
  "reservedHearts",
  "tickRate",
  "blinkCount",
  "clockSamples",
  "reliableFrameBytes",
  "baselineBytes",
  "queueBytes",
  "queueMessages",
  "inputBurst",
  "networkBytesPerSecond",
]);
const nonnegativeFields = new Set([
  "obstacleDamage",
  "playerContactDamage",
  "reservedHearts",
  "invincibleDuration",
  "roadSpeedIncrement",
  "spawnIntervalDecrement",
  "speedGrowth",
  "initialClearDistance",
  "heartExclusionDistance",
  "emptyWeight",
  "obstacleWeight",
  "coinWeight",
  "heartWeight",
  "carBottomMargin",
  "accelCarOffset",
  "blinkCount",
  "shakeDuration",
  "shakeIntensity",
  "carTiltMaxAngle",
  "gameOverFadeMaxOpacity",
  "gameOverShakeMultiplier",
  "gameOverShakeDuration",
  "gameOverFadeSpeed",
  "correctionSmoothing",
]);
const durationFields = new Set([
  "invincibleDuration",
  "initialSpawnInterval",
  "minSpawnInterval",
  "difficultyRampInterval",
  "laneSwitchCooldownDuration",
  "laneShiftDuration",
  "laneReturnDuration",
  "countdownDuration",
  "timeLimit",
  "reconnectGrace",
  "idleExpiry",
  "idleWarning",
  "verificationInterval",
  "controlRefreshInterval",
  "controlFreshnessExpiry",
  "replayHistory",
  "clockSyncInterval",
  "essentialQueueWait",
  "essentialProgressDeadline",
  "admissionTicketLifetime",
  "networkBudgetWindow",
  "simulationLagThreshold",
  "correctionSmoothing",
  "roundOverDelay",
]);
function captureGroup<T extends object>(group: string, baseline: T, override: unknown): Numeric<T> {
  requireValue(
    override === undefined ||
      (typeof override === "object" && override !== null && !Array.isArray(override)),
    group,
    "expected a settings object",
  );
  const fields = { ...baseline } as Record<string, number>;
  for (const [key, value] of Object.entries(override ?? {})) {
    requireValue(Object.hasOwn(baseline, key), `${group}.${key}`, "unknown or fixed setting");
    fields[key] = value;
  }
  for (const [key, value] of Object.entries(fields)) {
    const field = `${group}.${key}`;
    requireValue(
      typeof value === "number" && Number.isFinite(value),
      field,
      "must be a finite number",
    );
    requireValue(
      nonnegativeFields.has(key) ? value >= 0 : value > 0,
      field,
      nonnegativeFields.has(key) ? "must be nonnegative" : "must be positive",
    );
    if (integerFields.has(key))
      requireValue(Number.isSafeInteger(value), field, "must be an exact integer");
    if (durationFields.has(key)) {
      const micros = value * 1e6;
      requireValue(
        Number.isFinite(micros) &&
          micros <= Number.MAX_SAFE_INTEGER &&
          (value === 0 || micros >= 1),
        field,
        "must fit exact microsecond timestamps",
      );
    }
  }
  return Object.freeze(fields) as Numeric<T>;
}
/** Validate before capture. No caller-owned object survives into an active game. */
export function captureConfiguration<M extends Mode>(
  mode: M,
  overrides: ConfigurationOverrides<M> = {},
): Configuration<M> {
  requireValue(Object.hasOwn(defaults.gameplay, mode), "mode", "unsupported gameplay mode");
  requireValue(
    typeof overrides === "object" && overrides !== null && !Array.isArray(overrides),
    "configuration",
    "expected settings groups",
  );
  for (const key of Object.keys(overrides))
    requireValue(
      ["gameplay", "presentation", "room", "connection", "operational"].includes(key),
      key,
      "unknown configuration group",
    );
  const gameplay = captureGroup(
    "gameplay",
    defaults.gameplay[mode],
    overrides.gameplay,
  ) as GameplayConfig<M>;
  const presentation = captureGroup("presentation", defaults.presentation, overrides.presentation);
  const room = captureGroup("room", defaults.room, overrides.room);
  const connection = captureGroup("connection", defaults.connection, overrides.connection);
  const operational = captureGroup("operational", defaults.operational, overrides.operational);
  const g = gameplay as unknown as Record<string, number>;
  requireValue(
    g.maxRoadSpeed >= g.startingRoadSpeed,
    "gameplay.maxRoadSpeed",
    "must be at least startingRoadSpeed",
  );
  requireValue(
    g.accelSpeedMultiplier >= 1,
    "gameplay.accelSpeedMultiplier",
    "must be at least one",
  );
  requireValue(
    Number.isFinite(g.maxRoadSpeed * g.accelSpeedMultiplier),
    "gameplay.maxRoadSpeed",
    "boosted speed must remain finite",
  );
  requireValue(
    g.laneSpacing > Math.max(g.carWidth, g.obstacleW, g.coinSize, g.heartSize),
    "gameplay.laneSpacing",
    "must exceed every car/object width",
  );
  const totalWeight = g.emptyWeight + g.obstacleWeight + g.coinWeight + g.heartWeight;
  requireValue(
    Number.isFinite(totalWeight) && totalWeight > 0,
    "gameplay.weights",
    "must have a finite positive total",
  );
  if (mode === "long-drive") {
    requireValue(
      g.minSpawnInterval <= g.initialSpawnInterval,
      "gameplay.minSpawnInterval",
      "cannot exceed initialSpawnInterval",
    );
    requireValue(
      Number.isFinite(g.maxRoadSpeed + g.roadSpeedIncrement),
      "gameplay.roadSpeedIncrement",
      "derived speed must remain finite",
    );
  } else {
    requireValue(g.tickRate <= CounterMax, "gameplay.tickRate", "must fit an unsigned 32-bit tick");
    requireValue(
      Number.isFinite(
        g.maxRoadSpeed * g.accelSpeedMultiplier +
          g.carHeight +
          Math.max(g.obstacleH, g.coinSize, g.heartSize),
      ),
      "gameplay.maxRoadSpeed",
      "reachable coverage must remain finite",
    );
    if (mode === "drag-race") {
      requireValue(
        g.invincibleDuration === 0,
        "gameplay.invincibleDuration",
        "Drag Race never grants damage invincibility",
      );
      requireValue(
        g.finishDistance > Math.max(g.initialClearDistance, g.carHeight / 2),
        "gameplay.finishDistance",
        "must exceed clear distance and starting front edge",
      );
      if (g.reservedHearts > 0) {
        const spacing = g.finishDistance / (g.reservedHearts + 1);
        requireValue(
          Number.isFinite(g.reservedHearts + 1) &&
            spacing - g.heartSize / 2 > g.initialClearDistance &&
            spacing > g.heartSize &&
            g.finishDistance - spacing + g.heartSize / 2 < g.finishDistance,
          "gameplay.reservedHearts",
          "whole hearts must fit beyond clear road, before finish, without overlapping",
        );
      }
    } else {
      requireValue(
        g.timeLimit * g.tickRate <= CounterMax,
        "gameplay.timeLimit",
        "round must end before tick exhaustion",
      );
      requireValue(
        Number.isFinite(g.speedGrowth * g.timeLimit),
        "gameplay.speedGrowth",
        "derived growth must remain finite",
      );
    }
  }
  for (const key of [
    "roadWidthRatioNormal",
    "roadWidthRatioNarrow",
    "gameOverFadeMaxOpacity",
  ] as const)
    requireValue(presentation[key] <= 1, `presentation.${key}`, "must be at most one");
  requireValue(
    presentation.correctionSmoothing <= 0.25,
    "presentation.correctionSmoothing",
    "must be zero or at most 250 ms",
  );
  requireValue(
    presentation.roundOverDelay >= 1,
    "presentation.roundOverDelay",
    "must be at least one second",
  );
  requireValue(
    presentation.gameOverFadeMaxOpacity === 0 || presentation.gameOverFadeSpeed > 0,
    "presentation.gameOverFadeSpeed",
    "positive opacity requires a positive fade rate",
  );
  requireValue(room.idleWarning < room.idleExpiry, "room.idleWarning", "must precede idle expiry");
  requireValue(
    connection.verificationInterval <= 0.25,
    "connection.verificationInterval",
    "must be at most 250 ms",
  );
  requireValue(
    connection.controlRefreshInterval <= connection.controlFreshnessExpiry / 3,
    "connection.controlRefreshInterval",
    "must be at most one third of freshness expiry",
  );
  requireValue(
    connection.replayHistory >= defaults.fixed.predictionHorizon + connection.verificationInterval,
    "connection.replayHistory",
    "must cover prediction horizon plus verification interval",
  );
  requireValue(
    connection.reliableFrameBytes <= connection.queueBytes,
    "connection.reliableFrameBytes",
    "frames including framing must fit queue",
  );
  requireValue(
    connection.reliableFrameBytes > 4,
    "connection.reliableFrameBytes",
    "must fit the length prefix and message discriminator",
  );
  requireValue(
    connection.reliableFrameBytes - 4 <= CounterMax,
    "connection.reliableFrameBytes",
    "body length must fit uint32",
  );
  requireValue(
    connection.essentialQueueWait <= connection.essentialProgressDeadline,
    "connection.essentialQueueWait",
    "cannot exceed essential progress deadline",
  );
  requireValue(
    connection.inputRate >= 1 / connection.controlRefreshInterval,
    "connection.inputRate",
    "must accommodate held-control refreshes",
  );
  requireValue(
    connection.clockRequestRate >= 1 / connection.clockSyncInterval,
    "connection.clockRequestRate",
    "must accommodate clock synchronization",
  );
  if (mode !== "long-drive") {
    // Pre-schema representability checks. #27 must additionally check the actual
    // serialized continuation/baseline and signed projection widths; this lower
    // bound never claims a complete wire-size validation.
    const reach =
      g.maxRoadSpeed * g.accelSpeedMultiplier * defaults.fixed.predictionHorizon +
      g.carHeight +
      Math.max(g.obstacleH, g.coinSize, g.heartSize);
    requireValue(
      Number.isSafeInteger(Math.ceil(reach * 1024)),
      "gameplay.maxRoadSpeed",
      "coverage projection must remain an exact JavaScript integer",
    );
    const cells = 2 * defaults.fixed.laneCount * (Math.ceil(reach / g.sliceSpacing) + 2);
    requireValue(
      Number.isSafeInteger(cells),
      "gameplay.sliceSpacing",
      "reachable cell count must be representable",
    );
    requireValue(
      cells <= connection.baselineBytes * 8,
      "connection.baselineBytes",
      "cannot even represent one consumption bit per reachable cell",
    );
    for (const key of [
      "laneSpacing",
      "carWidth",
      "carHeight",
      "obstacleW",
      "obstacleH",
      "coinSize",
      "heartSize",
      "finishDistance",
      "initialClearDistance",
      "heartExclusionDistance",
    ]) {
      if (g[key] !== undefined)
        requireValue(
          Number.isSafeInteger(Math.ceil(g[key] * 1024)),
          `gameplay.${key}`,
          "projection must remain an exact JavaScript integer",
        );
    }
  }
  const configuration = Object.freeze({
    version: defaults.version,
    mode,
    gameplay,
    presentation,
    room,
    connection,
    operational,
  });
  try {
    configurationResources(configuration);
  } catch (error) {
    throw new ConfigurationError(
      "configuration.resources",
      error instanceof Error ? error.message : "unsupported serialization",
    );
  }
  return configuration;
}
/** Read-only drawing adapter; responsibility groups remain the canonical contract. */
export type GameConfig = GameplayConfig &
  PresentationConfig & {
    readonly laneCount: number;
    readonly coinScore: number;
    readonly offScreenThreshold: number;
  };
export function renderingConfig(configuration: Configuration): GameConfig {
  return Object.freeze({
    ...configuration.gameplay,
    ...configuration.presentation,
    laneCount: defaults.fixed.laneCount,
    coinScore: defaults.fixed.coinScore,
    offScreenThreshold: 2000,
  });
}
export const gameConfig = renderingConfig(captureConfiguration("long-drive"));
