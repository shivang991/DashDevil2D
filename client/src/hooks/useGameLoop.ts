import { useEffect } from "react";
import type { RefObject } from "react";
import type { GameState, GameContext } from "@/hooks/useGameContext";
import type { GameInput } from "@/hooks/useGameInput";
import { gameConfig } from "@/lib/constants";
import { gameAudio } from "@/lib/gameAudio";
import {
  drawRoad,
  drawCar,
  drawCoin,
  drawObstacle,
  drawGameOver,
} from "@/lib/renderUtils";

// ── Utility ──

function laneX(
  lane: number,
  canvasWidth: number,
  roadWidthRatio: number,
  laneCount: number,
): number {
  const roadWidth = canvasWidth * roadWidthRatio;
  const roadLeft = (canvasWidth - roadWidth) / 2;
  const laneWidth = roadWidth / laneCount;
  return roadLeft + laneWidth * lane + laneWidth / 2;
}

// ── Update — pure state mutation, no canvas drawing ──

function update(
  dt: number,
  input: GameInput,
  state: GameState,
  notify: (partial: Partial<GameState>) => void,
  restart: () => void,
): void {
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
    state.shakeOffsetX = (Math.random() * 2 - 1) * intensity;
    state.shakeOffsetY = (Math.random() * 2 - 1) * intensity;
    if (state.shakeTimer <= 0) {
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
      notify({ gameOverAnimDone: true });
    }
    if (state.gameOverAnimDone && input.popRestartToggle()) {
      restart();
      input.popPauseToggle(); // clear stale pause toggle after returning to playing
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
    if (state.countdownTimer <= 0) {
      state.countdownTimer = 0;
      state.status = "playing";
      notify({ status: "playing", countdownTimer: 0 });
    } else {
      notify({ countdownTimer: state.countdownTimer });
    }
    return;
  }

  // state.status === "playing"
  if (input.popPauseToggle()) {
    notify({ paused: !state.paused });
    return;
  }

  if (state.paused) return;

  // ── Initial Car Y position ──

  if (state.carYBase === 0) {
    state.carYBase =
      state.canvasHeight - gameConfig.carHeight - gameConfig.carBottomMargin;
    state.carY = state.carYBase;
  }

  // ── Lane switching with cooldown ──
  state.laneSwitchCooldown -= dt;
  if (state.laneSwitchCooldown <= 0) {
    if (input.isSteeringLeft()) {
      if (state.currentLane > 0) {
        state.currentLane--;
        state.laneSwitchCooldown = gameConfig.laneSwitchCooldownDuration;
      }
    } else if (input.isSteeringRight()) {
      if (state.currentLane < gameConfig.laneCount - 1) {
        state.currentLane++;
        state.laneSwitchCooldown = gameConfig.laneSwitchCooldownDuration;
      }
    }
  }

  // ── Smooth lane lerp ──
  const laneDiff = state.currentLane - state.visualLane;
  state.visualLane += laneDiff * Math.min(gameConfig.laneLerpSpeed * dt, 1);

  // ── Tilt animation ──
  const targetTilt =
    Math.max(-1, Math.min(1, laneDiff)) * gameConfig.carTiltMaxAngle;
  state.carTilt +=
    (targetTilt - state.carTilt) *
    Math.min(gameConfig.carTiltLerpSpeed * dt, 1);

  // ── Accelerate ──
  state.accelerating = input.isAccelerating();
  const targetCarY = state.accelerating
    ? state.carYBase - gameConfig.accelCarOffset
    : state.carYBase;
  state.carY +=
    (targetCarY - state.carY) * Math.min(gameConfig.accelLerpSpeed * dt, 1);

  const effectiveSpeed = state.accelerating
    ? state.roadSpeed * gameConfig.accelSpeedMultiplier
    : state.roadSpeed;

  // ── Scroll road ──
  state.roadOffset += effectiveSpeed * dt;

  // ── Move objects downward ──
  for (const obj of state.coins) obj.y += effectiveSpeed * dt;
  for (const obj of state.obstacles) obj.y += effectiveSpeed * dt;

  // ── Spawn timer ──
  state.spawnTimer += dt;
  if (state.spawnTimer >= state.spawnInterval) {
    state.spawnTimer = 0;
    const lane = Math.floor(Math.random() * gameConfig.laneCount);
    if (Math.random() < gameConfig.coinSpawnChance) {
      state.coins.push({
        lane,
        y: -gameConfig.coinSize,
        width: gameConfig.coinSize,
        height: gameConfig.coinSize,
      });
    } else {
      state.obstacles.push({
        lane,
        y: -gameConfig.obstacleH,
        width: gameConfig.obstacleW,
        height: gameConfig.obstacleH,
      });
    }
  }

  // ── Difficulty ramp ──
  state.difficultyTimer += dt;
  if (state.difficultyTimer > gameConfig.difficultyRampInterval) {
    state.difficultyTimer = 0;
    state.roadSpeed = Math.min(
      state.roadSpeed + gameConfig.roadSpeedIncrement,
      gameConfig.maxRoadSpeed,
    );
    state.spawnInterval = Math.max(
      state.spawnInterval - gameConfig.spawnIntervalDecrement,
      gameConfig.minSpawnInterval,
    );
  }

  // ── Hit effect timers ──
  if (state.invincibleTimer > 0) {
    state.invincibleTimer -= dt;
    const blinkPeriod =
      gameConfig.invincibleDuration / (gameConfig.blinkCount * 2);
    state.blinkTimer += dt;
    if (state.blinkTimer >= blinkPeriod) {
      state.blinkTimer -= blinkPeriod;
      state.carVisible = !state.carVisible;
    }
    if (state.invincibleTimer <= 0) {
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
    const overlapsX =
      carRight > objCx - coin.width / 2 && carLeft < objCx + coin.width / 2;
    const overlapsY = carBottom > coin.y && carTop < coin.y + coin.height;
    if (overlapsX && overlapsY) {
      state.score += gameConfig.coinScore;
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
    const overlapsX =
      carRight > objCx - obs.width / 2 && carLeft < objCx + obs.width / 2;
    const overlapsY = carBottom > obs.y && carTop < obs.y + obs.height;
    if (overlapsX && overlapsY) {
      if (state.invincibleTimer > 0) return false;
      state.health--;
      state.invincibleTimer = gameConfig.invincibleDuration;
      state.blinkTimer = 0;
      state.carVisible = true;
      state.shakeTimer = gameConfig.shakeDuration;
      if (state.health <= 0) {
        state.status = "gameover";
        state.invincibleTimer = 0;
        state.carVisible = true;
        state.shakeTimer = gameConfig.gameOverShakeDuration;
        state.shakeIntensityMultiplier = gameConfig.gameOverShakeMultiplier;
        input.popRestartToggle(); // invalidate stale restart input on gameover
      }
      return false;
    }
    return true;
  });

  // ── Remove off-screen objects ──
  state.coins = state.coins.filter((c) => c.y < gameConfig.offScreenThreshold);
  state.obstacles = state.obstacles.filter(
    (o) => o.y < gameConfig.offScreenThreshold,
  );

  // ── Notify React of reactive state changes ──
  notify({ score: state.score, health: state.health, status: state.status });
}

// ── Render — pure canvas drawing, no state mutation ──

function render(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: GameState,
): void {
  const needsTransform = state.shakeOffsetX !== 0 || state.shakeOffsetY !== 0;
  if (needsTransform) {
    ctx.save();
    ctx.translate(state.shakeOffsetX, state.shakeOffsetY);
  }

  drawRoad(ctx, state, gameConfig, width, height);

  for (const coin of state.coins) {
    const cx = laneX(
      coin.lane,
      width,
      state.roadWidthRatio,
      gameConfig.laneCount,
    );
    drawCoin(ctx, cx, coin.y, coin.width);
  }

  for (const obs of state.obstacles) {
    const ox = laneX(
      obs.lane,
      width,
      state.roadWidthRatio,
      gameConfig.laneCount,
    );
    drawObstacle(ctx, ox, obs.y, obs.width, obs.height);
  }

  if (state.carVisible) {
    const carX = laneX(
      state.visualLane,
      width,
      state.roadWidthRatio,
      gameConfig.laneCount,
    );
    drawCar(ctx, carX, state, gameConfig);
  }

  if (needsTransform) {
    ctx.restore();
  }

  if (state.status === "gameover") {
    drawGameOver(ctx, state, width, height);
  }
}

// ── Hook ──

interface UseGameLoopProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  gameInput: GameInput;
  gameContext: GameContext;
}

export function useGameLoop({
  canvasRef,
  gameContext,
  gameInput,
}: UseGameLoopProps): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const newState: Partial<GameState> = {};
      newState.canvasWidth = canvas.width;
      newState.canvasHeight = canvas.height;
      newState.roadWidthRatio =
        canvas.width <= gameConfig.narrowScreenWidth
          ? gameConfig.roadWidthRatioNarrow
          : gameConfig.roadWidthRatioNormal;
      gameContext.updateGameState(newState);
    };

    resize();
    window.addEventListener("resize", resize);

    let animationId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, gameConfig.maxDeltaTime);
      lastTime = now;

      update(
        dt,
        gameInput,
        gameContext.gameState,
        gameContext.updateGameState,
        gameContext.resetGameState,
      );
      gameAudio.update(gameContext.gameState);

      const ctx = canvas.getContext("2d");
      if (ctx) {
        render(ctx, canvas.width, canvas.height, gameContext.gameState);
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    console.log("Re running");

    return () => {
      cancelAnimationFrame(animationId);
      gameAudio.stop();
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef, gameContext, gameInput]);
}
