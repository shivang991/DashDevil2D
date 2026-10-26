import { firstContact, type Bounds } from "./geometry";
import { appendSlice, createTrack, draw, retireSlices } from "./track";
import {
  captureConfiguration,
  renderingConfig,
  type Configuration,
  type ConfigurationOverrides,
  type GameConfig,
} from "./config";
import { makeInitialState, type GameState } from "./state";

export interface LongDriveInput {
  steering?: "left" | "right";
  accelerating?: boolean;
  pause?: boolean;
  restart?: boolean;
}
/** Identified local observations. observedAt is this adapter advance boundary,
 * not canonical input/contact time. timeUs identifies canonical contact time excluding countdown. */
export interface LongDriveEvent {
  readonly id: number;
  readonly observedAt: number;
  readonly type:
    "countdown" | "go" | "lane" | "coin" | "heart" | "damage" | "gameover" | "pause" | "resume";
  readonly objectId?: number;
  readonly timeUs?: number;
}
export interface LongDrive {
  readonly state: GameState;
  readonly random: () => number;
  readonly configuration: Configuration;
  time: number;
  roundTime: number;
  eventId: number;
  countdownDisplay?: number;
}
const freshSeed = () => Math.floor(Math.random() * 0xffffffff) + 1;
const seedSources = new WeakMap<object, () => number>();
export function createLongDrive(
  source: number | (() => number) | undefined = undefined,
  overrides: ConfigurationOverrides = {},
): LongDrive {
  const configuration = captureConfiguration("long-drive", overrides);
  const seed = source === undefined ? freshSeed() : typeof source === "number" ? source : 1;
  const track = createTrack(seed);
  const random = typeof source === "function" ? source : () => draw(track);
  const state = makeInitialState(
    typeof source === "function" ? source : () => seed / 0x100000000,
    renderingConfig(configuration),
  );
  state.track = track;
  const game = { state, random, time: 0, roundTime: 0, eventId: 0 };
  Object.defineProperty(game, "configuration", { get: () => configurations.get(game) });
  configurations.set(game, configuration);
  seedSources.set(game, source === undefined ? freshSeed : () => seed);
  return game as LongDrive;
}
// Captured settings cannot be replaced through the public game object.
const configurations = new WeakMap<object, Configuration>();
/** Reset one owned game, retaining current viewport and monotonic effect identities. */
export function resetLongDrive(game: LongDrive, overrides?: ConfigurationOverrides): void {
  const configuration = captureConfiguration(
    "long-drive",
    overrides ?? {
      gameplay: game.configuration.gameplay,
      presentation: game.configuration.presentation,
    },
  );
  const gameConfig = renderingConfig(configuration);
  configurations.set(game, configuration);
  const { canvasWidth, canvasHeight, roadWidthRatio, track: previousTrack } = game.state;
  const carYBase = canvasHeight - gameConfig.carHeight - gameConfig.carBottomMargin;
  Object.assign(game.state, makeInitialState(game.random, gameConfig), {
    canvasWidth,
    canvasHeight,
    roadWidthRatio,
    carYBase,
    carY: carYBase,
    countdownTimer: 3,
  });
  // Fresh production round seed; explicit developer seeds replay deterministically.
  Object.assign(previousTrack, createTrack(seedSources.get(game)!()));
  game.state.track = previousTrack;
  game.roundTime = 0;
  game.countdownDisplay = undefined;
}
// Preserve the baseline 60 Hz easing feel while removing rendering-FPS dependence.
function ease(rate: number, dt: number) {
  return rate < 60 ? 1 - Math.pow(1 - rate / 60, dt * 60) : 1 - Math.exp(-rate * dt);
}
export function advanceLongDrive(
  game: LongDrive,
  seconds: number,
  input: LongDriveInput,
): readonly LongDriveEvent[] {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error("Elapsed time must be finite and nonnegative");
  const events: LongDriveEvent[] = [];
  const emit = (type: LongDriveEvent["type"], objectId?: number, timeUs?: number) =>
    events.push(
      Object.freeze({ id: ++game.eventId, observedAt: game.time, type, objectId, timeUs }),
    );
  if (game.state.status === "playing" && input.pause) {
    game.state.paused = !game.state.paused;
    emit(game.state.paused ? "pause" : "resume");
    return Object.freeze(events);
  }
  const announceCountdown = () => {
    const display =
      game.state.status === "countdown" ? Math.ceil(game.state.countdownTimer - 1e-12) : undefined;
    if (display !== undefined && display !== game.countdownDisplay) emit("countdown");
    game.countdownDisplay = display;
  };
  if (input.restart && game.state.status === "gameover" && game.state.gameOverAnimDone) {
    resetLongDrive(game);
    announceCountdown();
    return Object.freeze(events);
  }
  announceCountdown();
  if (game.state.paused) return Object.freeze(events);
  const observedAt = game.time + (game.state.paused ? 0 : seconds);
  const restart = () => resetLongDrive(game);
  // Countdown expiry splits an advance: elapsed active time is never discarded.
  const config = renderingConfig(game.configuration);
  let remaining = seconds;
  while (remaining > 1e-12) {
    const step = Math.min(
      remaining,
      1 / 120,
      game.state.status === "playing"
        ? Math.max(1e-12, game.state.spawnInterval - game.state.spawnTimer)
        : Infinity,
      game.state.status === "playing"
        ? Math.max(1e-12, config.difficultyRampInterval - game.state.difficultyTimer)
        : Infinity,
      game.state.status === "countdown" ? Math.max(game.state.countdownTimer, 1e-12) : Infinity,
    );
    if (!game.state.paused) game.time += step;
    const playing = game.state.status === "playing" && !game.state.paused;
    if (playing) game.roundTime += step;
    tick(step, input, game.state, restart, game.random, emit, config, game.roundTime);
    announceCountdown();
    remaining -= step;
    // Commands are edge-triggered; held movement persists across the advance.
    input = { ...input, pause: false, restart: false };
  }
  return Object.freeze(events.map((event) => Object.freeze({ ...event, observedAt })));
}
function tick(
  dt: number,
  input: LongDriveInput,
  state: GameState,
  restart: () => void,
  random: () => number,
  emit: (type: LongDriveEvent["type"], objectId?: number, timeUs?: number) => void,
  gameConfig: GameConfig,
  timeEnd: number,
): void {
  if (state.paused && !input.pause) return;

  // ── Shake timer — runs even during gameover ──
  if (state.shakeTimer > 0) {
    state.shakeTimer -= dt;
    const duration =
      state.status === "gameover" ? gameConfig.gameOverShakeDuration : gameConfig.shakeDuration;
    const t = Math.max(0, state.shakeTimer / duration);
    const intensity = gameConfig.shakeIntensity * state.shakeIntensityMultiplier * t;
    // Decorative shake cannot consume gameplay randomness (or FPS would change spawns).
    state.shakeOffsetX = Math.sin(state.shakeTimer * 137) * intensity;
    state.shakeOffsetY = Math.cos(state.shakeTimer * 101) * intensity;
    if (state.shakeTimer <= 1e-12) {
      state.shakeTimer = 0;
      state.shakeOffsetX = 0;
      state.shakeOffsetY = 0;
      state.shakeIntensityMultiplier = 1;
    }
  }

  if (state.status === "gameover") {
    state.gameOverFadeAlpha = Math.min(
      gameConfig.gameOverFadeMaxOpacity,
      state.gameOverFadeAlpha + gameConfig.gameOverFadeSpeed * dt,
    );
    if (
      !state.gameOverAnimDone &&
      state.shakeTimer <= 0 &&
      state.gameOverFadeAlpha >= gameConfig.gameOverFadeMaxOpacity
    ) {
      state.gameOverAnimDone = true;
    }
    if (state.gameOverAnimDone && input.restart) {
      restart();
      // Input adapter clears stale pause commands after restart.
    }
    return;
  }

  // ── Countdown state ──
  if (state.status === "countdown") {
    // Initialize car position during countdown so the road renders
    if (state.carYBase === 0) {
      state.carYBase = state.canvasHeight - gameConfig.carHeight - gameConfig.carBottomMargin;
      state.carY = state.carYBase;
    }
    state.countdownTimer -= dt;
    if (state.countdownTimer <= 1e-12) {
      state.countdownTimer = 0;
      state.status = "playing";
      emit("go");
    }
    return;
  }

  // ── Initial Car Y position ──

  if (state.carYBase === 0) {
    state.carYBase = state.canvasHeight - gameConfig.carHeight - gameConfig.carBottomMargin;
    state.carY = state.carYBase;
  }

  const startProgress = state.roadOffset;
  const startLane = state.visualLane;
  const startOffset = state.carOffset;
  const protectionAtStart = state.invincibleTimer;
  const objects = [...state.coins, ...state.hearts, ...state.obstacles];
  for (const object of objects) {
    // Legacy fixture ingress only; generated placements already carry centers.
    object.id ??= state.track.nextId++;
    state.track.nextId = Math.max(state.track.nextId, object.id + 1);
    object.distance ??=
      startProgress + state.carYBase + gameConfig.carHeight / 2 - object.y - object.height / 2;
  }

  // ── Lane switching with cooldown ──
  state.laneSwitchCooldown -= dt;
  if (state.laneSwitchCooldown <= 0) {
    if (input.steering === "left") {
      if (state.currentLane > 0) {
        state.currentLane--;
        emit("lane");
        state.laneSwitchCooldown = gameConfig.laneSwitchCooldownDuration;
      }
    } else if (input.steering === "right") {
      if (state.currentLane < gameConfig.laneCount - 1) {
        state.currentLane++;
        emit("lane");
        state.laneSwitchCooldown = gameConfig.laneSwitchCooldownDuration;
      }
    }
  }

  // ── Smooth lane lerp ──
  const laneDiff = state.currentLane - state.visualLane;
  state.visualLane += laneDiff * ease(gameConfig.laneLerpSpeed, dt);

  // ── Tilt animation ──
  const targetTilt = Math.max(-1, Math.min(1, laneDiff)) * gameConfig.carTiltMaxAngle;
  state.carTilt += (targetTilt - state.carTilt) * ease(gameConfig.carTiltLerpSpeed, dt);

  // ── Accelerate ──
  state.accelerating = Boolean(input.accelerating);
  const targetOffset = state.accelerating ? gameConfig.accelCarOffset : 0;
  state.carOffset += (targetOffset - state.carOffset) * ease(gameConfig.accelLerpSpeed, dt);
  state.carY = state.carYBase - state.carOffset;

  const effectiveSpeed = state.accelerating
    ? state.roadSpeed * gameConfig.accelSpeedMultiplier
    : state.roadSpeed;

  // ── Scroll road ──
  state.roadOffset += effectiveSpeed * dt;

  // ── Hit effect timers ──
  if (state.invincibleTimer > 0) {
    state.invincibleTimer -= dt;
    const blinkPeriod =
      gameConfig.blinkCount === 0
        ? Infinity
        : gameConfig.invincibleDuration / (gameConfig.blinkCount * 2);
    state.blinkTimer += dt;
    while (state.blinkTimer + 1e-12 >= blinkPeriod) {
      state.blinkTimer -= blinkPeriod;
      state.carVisible = !state.carVisible;
    }
    if (state.invincibleTimer <= 1e-12) {
      state.invincibleTimer = 0;
      state.carVisible = true;
    }
  }

  // World centers and strict swept AABB. Neither viewport nor tilt enters here.
  const carBounds = (lane: number, progress: number, offset: number): Bounds => {
    const x = (lane - 1) * gameConfig.laneSpacing;
    const distance = progress + offset;
    return {
      left: x - gameConfig.carWidth / 2,
      right: x + gameConfig.carWidth / 2,
      top: -distance - gameConfig.carHeight / 2,
      bottom: -distance + gameConfig.carHeight / 2,
    };
  };
  const before = carBounds(startLane, startProgress, startOffset);
  const after = carBounds(state.visualLane, state.roadOffset, state.carOffset);
  const contacts = objects
    .flatMap((object) => {
      const x = (object.lane - 1) * gameConfig.laneSpacing;
      const bounds = {
        left: x - object.width / 2,
        right: x + object.width / 2,
        top: -object.distance! - object.height / 2,
        bottom: -object.distance! + object.height / 2,
      };
      const fraction = firstContact(before, after, bounds, bounds);
      const kind = state.coins.includes(object)
        ? "coin"
        : state.hearts.includes(object)
          ? "heart"
          : "obstacle";
      return fraction === null
        ? []
        : [
            {
              object,
              kind,
              fraction,
              timeUs: Math.floor((timeEnd - dt + dt * fraction) * 1e6 + 0.5),
            },
          ];
    })
    .sort(
      (a, b) =>
        a.timeUs - b.timeUs ||
        (a.kind === "obstacle" ? 1 : 0) - (b.kind === "obstacle" ? 1 : 0) ||
        (a.object.id ?? 0) - (b.object.id ?? 0),
    );
  let fatalTime: number | undefined;
  let protectionUntil = Math.floor((timeEnd - dt + protectionAtStart) * 1e6 + 0.5);
  const consumed = new Set<(typeof objects)[number]>();
  for (const { object, kind, fraction, timeUs } of contacts) {
    if (fatalTime !== undefined && timeUs > fatalTime) break;
    consumed.add(object);
    if (object.id !== undefined) state.track.consumed.add(object.id);
    if (kind === "coin") {
      state.score += gameConfig.coinScore;
      emit("coin", object.id, timeUs);
    } else if (kind === "heart") {
      state.health = Math.min(gameConfig.maxHealth, state.health + 1);
      emit("heart", object.id, timeUs);
    } else if (
      protectionUntil <= timeUs &&
      state.status !== "gameover" &&
      gameConfig.obstacleDamage > 0
    ) {
      state.health = Math.max(0, state.health - gameConfig.obstacleDamage);
      emit("damage", object.id, timeUs);
      protectionUntil = timeUs + Math.floor(gameConfig.invincibleDuration * 1e6 + 0.5);
      state.invincibleTimer = Math.max(0, protectionUntil / 1e6 - timeEnd);
      state.blinkTimer = 0;
      state.carVisible = true;
      state.shakeTimer = gameConfig.shakeDuration;
      if (state.health === 0) {
        state.status = "gameover";
        fatalTime = timeUs;
        emit("gameover", undefined, timeUs);
        state.invincibleTimer = 0;
        state.shakeTimer = gameConfig.gameOverShakeDuration;
        state.shakeIntensityMultiplier = gameConfig.gameOverShakeMultiplier;
        // Stop travel at the terminal contact rather than at the render endpoint.
        state.roadOffset = startProgress + (state.roadOffset - startProgress) * fraction;
        state.visualLane = startLane + (state.visualLane - startLane) * fraction;
        state.carOffset = startOffset + (state.carOffset - startOffset) * fraction;
        state.carY = state.carYBase - state.carOffset;
      }
    }
  }
  state.coins = state.coins.filter((object) => !consumed.has(object));
  state.hearts = state.hearts.filter((object) => !consumed.has(object));
  state.obstacles = state.obstacles.filter((object) => !consumed.has(object));
  if (state.status !== "gameover") {
    // ── Spawn timer ──
    state.spawnTimer += dt;
    while (state.spawnTimer + 1e-12 >= state.spawnInterval) {
      state.spawnTimer = Math.max(0, state.spawnTimer - state.spawnInterval);
      const slice = appendSlice(
        state.track,
        state.roadOffset,
        gameConfig,
        Math.floor(timeEnd * 1e6 + 0.5),
        random,
      );
      const lane = slice.cells.findIndex((cell) => cell !== "empty");
      if (lane >= 0) {
        const kind = slice.cells[lane];
        const height =
          kind === "obstacle"
            ? gameConfig.obstacleH
            : kind === "heart"
              ? gameConfig.heartSize
              : gameConfig.coinSize;
        const width = kind === "obstacle" ? gameConfig.obstacleW : height;
        const object = { id: slice.id, lane, distance: slice.distance, y: -height, width, height };
        (kind === "coin" ? state.coins : kind === "heart" ? state.hearts : state.obstacles).push(
          object,
        );
      }
    }

    // ── Difficulty ramp ──
    state.difficultyTimer += dt;
    while (state.difficultyTimer + 1e-12 >= gameConfig.difficultyRampInterval) {
      state.difficultyTimer = Math.max(
        0,
        state.difficultyTimer - gameConfig.difficultyRampInterval,
      );
      state.roadSpeed = Math.min(
        state.roadSpeed + gameConfig.roadSpeedIncrement,
        gameConfig.maxRoadSpeed,
      );
      state.spawnInterval = Math.max(
        Math.round((state.spawnInterval - gameConfig.spawnIntervalDecrement) * 1e12) / 1e12,
        gameConfig.minSpawnInterval,
      );
    }
  }
  state.carWorldX = (state.visualLane - 1) * gameConfig.laneSpacing;
  state.carWorldDistance = state.roadOffset + state.carOffset;
  // Keep missed sprites through the bottom margin until fully outside the view.
  // The renderer scales this fixed margin with the road on tall screens.
  const behind = state.roadOffset - gameConfig.carHeight / 2 - gameConfig.carBottomMargin;
  retireSlices(state.track, behind, gameConfig);
  const retain = (object: (typeof objects)[number]) =>
    object.distance! + object.height / 2 >= behind;
  state.coins = state.coins.filter(retain);
  state.hearts = state.hearts.filter(retain);
  state.obstacles = state.obstacles.filter(retain);
}
