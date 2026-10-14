import { laneCenter as laneX, overlaps } from "./geometry";
import { captureConfiguration, renderingConfig, type Configuration, type ConfigurationOverrides, type GameConfig } from "./config";
import { makeInitialState, type GameState } from "./state";

export interface LongDriveInput { steering?: "left" | "right"; accelerating?: boolean; pause?: boolean; restart?: boolean }
/** Identified local observations. observedAt is this adapter advance boundary,
 * not canonical input/contact time; chronological canonical integration belongs to #26. */
export interface LongDriveEvent { readonly id: number; readonly observedAt: number; readonly type: "countdown" | "go" | "lane" | "coin" | "heart" | "damage" | "gameover" | "pause" | "resume"; readonly objectId?: number }
export interface LongDrive { readonly state: GameState; readonly random: () => number; readonly configuration: Configuration; time: number; eventId: number; countdownDisplay?: number }
export function createLongDrive(random: () => number = Math.random, overrides: ConfigurationOverrides = {}): LongDrive {
  const configuration = captureConfiguration("long-drive", overrides);
  const game = { state: makeInitialState(random, renderingConfig(configuration)), random, time: 0, eventId: 0 };
  Object.defineProperty(game, "configuration", { get: () => configurations.get(game) });
  configurations.set(game, configuration);
  return game as LongDrive;
}
// Captured settings cannot be replaced through the public game object.
const configurations = new WeakMap<object, Configuration>();
/** Reset one owned game, retaining current viewport and monotonic effect identities. */
export function resetLongDrive(game: LongDrive, overrides?: ConfigurationOverrides): void {
  const configuration = captureConfiguration("long-drive", overrides ?? { gameplay: game.configuration.gameplay, presentation: game.configuration.presentation });
  const gameConfig = renderingConfig(configuration);
  configurations.set(game, configuration);
  const { canvasWidth, canvasHeight, roadWidthRatio } = game.state;
  const carYBase = canvasHeight - gameConfig.carHeight - gameConfig.carBottomMargin;
  Object.assign(game.state, makeInitialState(game.random, gameConfig), {
    canvasWidth, canvasHeight, roadWidthRatio, carYBase, carY: carYBase, countdownTimer: 3,
  });
  game.countdownDisplay = undefined;
}
// Preserve the baseline 60 Hz easing feel while removing rendering-FPS dependence.
function ease(rate: number, dt: number) { return rate < 60 ? 1 - Math.pow(1 - rate / 60, dt * 60) : 1 - Math.exp(-rate * dt); }
const objectIds = new WeakMap<GameState, number>();
function nextObjectId(state: GameState) { const id = (objectIds.get(state) ?? 0) + 1; objectIds.set(state, id); return id; }
export function advanceLongDrive(game: LongDrive, seconds: number, input: LongDriveInput): readonly LongDriveEvent[] {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error("Elapsed time must be finite and nonnegative");
  const events: LongDriveEvent[] = [];
  const emit = (type: LongDriveEvent["type"], objectId?: number) => events.push(Object.freeze({ id: ++game.eventId, observedAt: game.time, type, objectId }));
  if (game.state.status === "playing" && input.pause) {
    game.state.paused = !game.state.paused;
    emit(game.state.paused ? "pause" : "resume");
    return Object.freeze(events);
  }
  const announceCountdown = () => {
    const display = game.state.status === "countdown" ? Math.ceil(game.state.countdownTimer - 1e-12) : undefined;
    if (display !== undefined && display !== game.countdownDisplay) emit("countdown");
    game.countdownDisplay = display;
  };
  announceCountdown();
  const restart = () => resetLongDrive(game);
  // Countdown expiry splits an advance: elapsed active time is never discarded.
  let remaining = seconds;
  while (remaining > 1e-12) {
    const step = Math.min(remaining, seconds <= 0.1 ? seconds : 1 / 60, game.state.status === "countdown" ? Math.max(game.state.countdownTimer, 1e-12) : Infinity);
    if (!game.state.paused) game.time += step;
    tick(step, input, game.state, restart, game.random, emit, renderingConfig(game.configuration));
    announceCountdown();
    remaining -= step;
    // Commands are edge-triggered; held movement persists across the advance.
    input = { ...input, pause: false, restart: false };
  }
  return Object.freeze(events);
}
function tick(
  dt: number,
  input: LongDriveInput,
  state: GameState,
  restart: () => void,
  random: () => number,
  emit: (type: LongDriveEvent["type"], objectId?: number) => void,
  gameConfig: GameConfig,
): void {
  if (state.paused && !input.pause) return;

  // ── Shake timer — runs even during gameover ──
  if (state.shakeTimer > 0) {
    state.shakeTimer -= dt;
    const duration =
      state.shakeIntensityMultiplier > 1
        ? gameConfig.gameOverShakeDuration
        : gameConfig.shakeDuration;
    const t = Math.max(0, state.shakeTimer / duration);
    const intensity =
      gameConfig.shakeIntensity * state.shakeIntensityMultiplier * t;
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
      state.carYBase =
        state.canvasHeight - gameConfig.carHeight - gameConfig.carBottomMargin;
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
    state.carYBase =
      state.canvasHeight - gameConfig.carHeight - gameConfig.carBottomMargin;
    state.carY = state.carYBase;
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
  const targetTilt =
    Math.max(-1, Math.min(1, laneDiff)) * gameConfig.carTiltMaxAngle;
  state.carTilt +=
    (targetTilt - state.carTilt) *
    ease(gameConfig.carTiltLerpSpeed, dt);

  // ── Accelerate ──
  state.accelerating = Boolean(input.accelerating);
  const targetCarY = state.accelerating
    ? state.carYBase - gameConfig.accelCarOffset
    : state.carYBase;
  state.carY +=
    (targetCarY - state.carY) * ease(gameConfig.accelLerpSpeed, dt);

  const effectiveSpeed = state.accelerating
    ? state.roadSpeed * gameConfig.accelSpeedMultiplier
    : state.roadSpeed;

  // ── Scroll road ──
  state.roadOffset += effectiveSpeed * dt;

  // ── Move objects downward ──
  for (const obj of state.coins) obj.y += effectiveSpeed * dt;
  for (const obj of state.obstacles) obj.y += effectiveSpeed * dt;
  for (const obj of state.hearts) obj.y += effectiveSpeed * dt;

  // ── Spawn timer ──
  state.spawnTimer += dt;
  while (state.spawnTimer + 1e-12 >= state.spawnInterval) {
    state.spawnTimer = Math.max(0, state.spawnTimer - state.spawnInterval);
    const lane = Math.floor(random() * gameConfig.laneCount);
    const total = gameConfig.coinWeight + gameConfig.obstacleWeight + gameConfig.heartWeight + gameConfig.emptyWeight;
    const selection = random();
    // Coin-first partition preserves the baseline seeded coin/obstacle sequence.
    if (selection < gameConfig.coinWeight / total) {
      state.coins.push({
        id: nextObjectId(state),
        lane,
        y: -gameConfig.coinSize,
        width: gameConfig.coinSize,
        height: gameConfig.coinSize,
      });
    } else if (selection < (gameConfig.coinWeight + gameConfig.obstacleWeight) / total) {
      state.obstacles.push({
        id: nextObjectId(state),
        lane,
        y: -gameConfig.obstacleH,
        width: gameConfig.obstacleW,
        height: gameConfig.obstacleH,
      });
    } else if (selection < (gameConfig.coinWeight + gameConfig.obstacleWeight + gameConfig.heartWeight) / total) {
      state.hearts.push({ id: nextObjectId(state), lane, y: -gameConfig.heartSize, width: gameConfig.heartSize, height: gameConfig.heartSize });
    }
  }

  // ── Difficulty ramp ──
  state.difficultyTimer += dt;
  while (state.difficultyTimer + 1e-12 >= gameConfig.difficultyRampInterval) {
    state.difficultyTimer = Math.max(0, state.difficultyTimer - gameConfig.difficultyRampInterval);
    state.roadSpeed = Math.min(
      state.roadSpeed + gameConfig.roadSpeedIncrement,
      gameConfig.maxRoadSpeed,
    );
    state.spawnInterval = Math.max(
      Math.round((state.spawnInterval - gameConfig.spawnIntervalDecrement) * 1e12) / 1e12,
      gameConfig.minSpawnInterval,
    );
  }

  // ── Hit effect timers ──
  if (state.invincibleTimer > 0) {
    state.invincibleTimer -= dt;
    const blinkPeriod =
      gameConfig.blinkCount === 0 ? Infinity : gameConfig.invincibleDuration / (gameConfig.blinkCount * 2);
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

  // ── Collision detection (AABB) ──
  const w = state.canvasWidth;
  if (w === 0) return;

  const carCx = laneX(
    state.visualLane,
    w,
    state.roadWidthRatio,
    gameConfig.laneCount,
  );
  const carLeft = carCx - gameConfig.carWidth / 2;
  const carRight = carCx + gameConfig.carWidth / 2;
  const carTop = state.carY;
  const carBottom = state.carY + gameConfig.carHeight;

  state.coins = state.coins.filter((coin) => {
    const objCx = laneX(
      coin.lane,
      w,
      state.roadWidthRatio,
      gameConfig.laneCount,
    );
    if (overlaps({ left: carLeft, right: carRight, top: carTop, bottom: carBottom }, { left: objCx - coin.width / 2, right: objCx + coin.width / 2, top: coin.y, bottom: coin.y + coin.height })) {
      state.score += gameConfig.coinScore;
      emit("coin", coin.id);
      return false;
    }
    return true;
  });

  state.hearts = state.hearts.filter((heart) => {
    const cx = laneX(heart.lane, w, state.roadWidthRatio, gameConfig.laneCount);
    if (overlaps({ left: carLeft, right: carRight, top: carTop, bottom: carBottom }, { left: cx - heart.width / 2, right: cx + heart.width / 2, top: heart.y, bottom: heart.y + heart.height })) {
      state.health = Math.min(gameConfig.maxHealth, state.health + 1);
      emit("heart", heart.id);
      return false;
    }
    return true;
  });

  state.obstacles = state.obstacles.filter((obs) => {
    const objCx = laneX(
      obs.lane,
      w,
      state.roadWidthRatio,
      gameConfig.laneCount,
    );
    if (overlaps({ left: carLeft, right: carRight, top: carTop, bottom: carBottom }, { left: objCx - obs.width / 2, right: objCx + obs.width / 2, top: obs.y, bottom: obs.y + obs.height })) {
      if (state.invincibleTimer > 0 || state.status === "gameover") return false;
      state.health = Math.max(0, state.health - gameConfig.obstacleDamage);
      if (gameConfig.obstacleDamage === 0) return false;
      emit("damage", obs.id);
      state.invincibleTimer = gameConfig.invincibleDuration;
      state.blinkTimer = 0;
      state.carVisible = true;
      state.shakeTimer = gameConfig.shakeDuration;
      if (state.health <= 0) {
        state.status = "gameover";
        emit("gameover");
        state.invincibleTimer = 0;
        state.carVisible = true;
        state.shakeTimer = gameConfig.gameOverShakeDuration;
        state.shakeIntensityMultiplier = gameConfig.gameOverShakeMultiplier;
        // Input adapter discards stale restart commands on fatal events.
      }
      return false;
    }
    return true;
  });

  // ── Remove off-screen objects ──
  state.coins = state.coins.filter((c) => c.y < gameConfig.offScreenThreshold);
  state.hearts = state.hearts.filter((h) => h.y < gameConfig.offScreenThreshold);
  state.obstacles = state.obstacles.filter(
    (o) => o.y < gameConfig.offScreenThreshold,
  );

}

