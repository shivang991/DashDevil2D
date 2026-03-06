import { useCallback, useState, useRef, useEffect } from "react";
import { useGameCanvas } from "@/hooks/useGameCanvas";
import {
  drawRoad,
  drawCar,
  drawCoin,
  drawObstacle,
  drawGameOver,
} from "@/game/renderer";
import { GameStateManager } from "@/game/state";
import type { UpdateFn, RenderFn } from "@/game/types";

const COIN_SIZE = 28;
const OBSTACLE_W = 48;
const OBSTACLE_H = 40;

function createUpdate(state: GameStateManager): UpdateFn {
  return (dt, input) => {
    if (state.status !== "playing") return;

    // ── Lane switching with cooldown ──
    state.laneSwitchCooldown -= dt;
    if (state.laneSwitchCooldown <= 0) {
      if (input.isKeyDown("ArrowLeft") || input.isKeyDown("a")) {
        if (state.currentLane > 0) {
          state.currentLane--;
          state.laneSwitchCooldown = 0.15;
        }
      } else if (input.isKeyDown("ArrowRight") || input.isKeyDown("d")) {
        if (state.currentLane < state.laneCount - 1) {
          state.currentLane++;
          state.laneSwitchCooldown = 0.15;
        }
      }
    }

    // ── Smooth lane lerp ──
    const diff = state.currentLane - state.visualLane;
    state.visualLane += diff * Math.min(state.laneLerpSpeed * dt, 1);

    // ── Accelerate ──
    state.accelerating = input.isKeyDown("ArrowUp") || input.isKeyDown("w");

    const targetCarY = state.accelerating
      ? state.carYBase - state.accelCarOffset
      : state.carYBase;
    const carDiff = targetCarY - state.carY;
    state.carY += carDiff * Math.min(state.accelLerpSpeed * dt, 1);

    const effectiveSpeed = state.accelerating
      ? state.roadSpeed * state.accelSpeedMultiplier
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
      const lane = Math.floor(Math.random() * state.laneCount);
      const isCoin = Math.random() < 0.45;

      if (isCoin) {
        state.coins.push({
          lane,
          y: -COIN_SIZE,
          width: COIN_SIZE,
          height: COIN_SIZE,
        });
      } else {
        state.obstacles.push({
          lane,
          y: -OBSTACLE_H,
          width: OBSTACLE_W,
          height: OBSTACLE_H,
        });
      }
    }

    // ── Difficulty ramp ──
    state.difficultyTimer += dt;
    if (state.difficultyTimer > 3) {
      state.difficultyTimer = 0;
      state.roadSpeed = Math.min(state.roadSpeed + 15, 900);
      state.spawnInterval = Math.max(
        state.spawnInterval - 0.03,
        state.minSpawnInterval,
      );
    }

    // ── Hit effect timers ──
    if (state.invincibleTimer > 0) {
      state.invincibleTimer -= dt;
      // Blink: divide invincibility into segments, toggle visibility
      const blinkPeriod = state.invincibleDuration / (state.blinkCount * 2);
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

    if (state.shakeTimer > 0) {
      state.shakeTimer -= dt;
      const t = state.shakeTimer / state.shakeDuration; // 1→0
      const intensity = state.shakeIntensity * t;
      state.shakeOffsetX = (Math.random() * 2 - 1) * intensity;
      state.shakeOffsetY = (Math.random() * 2 - 1) * intensity;
      if (state.shakeTimer <= 0) {
        state.shakeTimer = 0;
        state.shakeOffsetX = 0;
        state.shakeOffsetY = 0;
      }
    }

    // ── Collision detection (AABB on both axes) ──
    const w = state.canvasWidth;
    if (w === 0) return; // canvas not ready yet

    const carCx = state.laneX(state.visualLane, w);
    const carLeft = carCx - state.carWidth / 2;
    const carRight = carCx + state.carWidth / 2;
    const carTop = state.carY;
    const carBottom = state.carY + state.carHeight;

    state.coins = state.coins.filter((coin) => {
      const objCx = state.laneX(coin.lane, w);
      const objLeft = objCx - coin.width / 2;
      const objRight = objCx + coin.width / 2;
      const objTop = coin.y;
      const objBottom = coin.y + coin.height;

      const overlapsX = carRight > objLeft && carLeft < objRight;
      const overlapsY = carBottom > objTop && carTop < objBottom;

      if (overlapsX && overlapsY) {
        state.score += 10;
        return false;
      }
      return true;
    });

    state.obstacles = state.obstacles.filter((obs) => {
      const objCx = state.laneX(obs.lane, w);
      const objLeft = objCx - obs.width / 2;
      const objRight = objCx + obs.width / 2;
      const objTop = obs.y;
      const objBottom = obs.y + obs.height;

      const overlapsX = carRight > objLeft && carLeft < objRight;
      const overlapsY = carBottom > objTop && carTop < objBottom;

      if (overlapsX && overlapsY) {
        // Skip damage if invincible, but still remove the obstacle
        if (state.invincibleTimer > 0) return false;

        state.health--;
        // Trigger hit effects
        state.invincibleTimer = state.invincibleDuration;
        state.blinkTimer = 0;
        state.carVisible = true;
        state.shakeTimer = state.shakeDuration;

        if (state.health <= 0) {
          state.status = "gameover";
          state.invincibleTimer = 0;
          state.carVisible = true;
          state.shakeOffsetX = 0;
          state.shakeOffsetY = 0;
        }
        return false;
      }
      return true;
    });

    // ── Remove off-screen objects ──
    state.coins = state.coins.filter((c) => c.y < 2000);
    state.obstacles = state.obstacles.filter((o) => o.y < 2000);
  };
}

function createRender(state: GameStateManager): RenderFn {
  return (ctx, width, height) => {
    state.canvasWidth = width;
    // Full-width road on small screens (no grass), narrower on larger
    state.roadWidthRatio = width <= 320 ? 1.0 : 0.6;
    if (state.carYBase === 0) {
      state.carYBase = height - state.carHeight - 40;
      state.carY = state.carYBase;
    }

    // Apply screen shake
    const shaking = state.shakeOffsetX !== 0 || state.shakeOffsetY !== 0;
    if (shaking) {
      ctx.save();
      ctx.translate(state.shakeOffsetX, state.shakeOffsetY);
    }

    drawRoad(ctx, state, width, height);

    for (const coin of state.coins) {
      const cx = state.laneX(coin.lane, width);
      drawCoin(ctx, cx, coin.y, coin.width);
    }

    for (const obs of state.obstacles) {
      const ox = state.laneX(obs.lane, width);
      drawObstacle(ctx, ox, obs.y, obs.width, obs.height);
    }

    if (state.carVisible) {
      drawCar(ctx, state, width);
    }

    if (shaking) {
      ctx.restore();
    }

    if (state.status === "gameover") {
      drawGameOver(ctx, state, width, height);
    }
  };
}

const MAX_HEALTH = 4;

export function GameScreen() {
  const stateRef = useRef<GameStateManager | null>(null);
  if (stateRef.current === null) {
    stateRef.current = new GameStateManager();
  }
  const state = stateRef.current;

  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(MAX_HEALTH);

  const update = useCallback<UpdateFn>(
    (dt, input) => {
      createUpdate(state)(dt, input);
      // Sync React state for UI
      setScore(state.score);
      setHealth(state.health);
      if (state.status === "gameover" && !gameOver) {
        setGameOver(true);
      }
    },
    [state, gameOver],
  );

  const render = useCallback<RenderFn>(
    (ctx, w, h) => createRender(state)(ctx, w, h),
    [state],
  );

  const { canvasRef, togglePause, engineRef } = useGameCanvas(update, render);

  const handleRestart = useCallback(() => {
    const canvas = canvasRef.current;
    state.reset(canvas ? canvas.height : 600);
    setGameOver(false);
    setPaused(false);
    setScore(0);
    setHealth(MAX_HEALTH);
    if (engineRef.current?.paused) {
      engineRef.current.togglePause();
    }
  }, [state, canvasRef, engineRef]);

  const handleTogglePause = useCallback(() => {
    if (state.status === "gameover") return;
    togglePause();
    setPaused((p) => !p);
  }, [state, togglePause]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        handleTogglePause();
      }
      if (e.key === "Enter" && gameOver) {
        e.preventDefault();
        handleRestart();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleTogglePause, handleRestart, gameOver]);

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-neutral-950 overflow-hidden">
      <div className="flex flex-col w-[320px] sm:w-160 h-screen max-h-screen overflow-hidden">
        {/* ── Top HUD bar ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-3 shrink-0">
          {/* Left side */}
          <div className="flex flex-col gap-1">
            <h1 className="text-white text-base sm:text-xl font-bold tracking-wide">
              Branding
            </h1>
            <p className="text-neutral-400 text-xs sm:text-sm">
              Accelerating! Hit [Space] to pause
            </p>
          </div>

          {/* Right side */}
          <div className="flex flex-col items-end gap-1">
            {/* Health hearts */}
            <div className="flex gap-1.5 sm:gap-2">
              {Array.from({ length: MAX_HEALTH }).map((_, i) => (
                <div
                  key={i}
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 ${
                    i < health
                      ? "bg-red-500 border-red-400"
                      : "bg-transparent border-neutral-600"
                  }`}
                />
              ))}
            </div>

            {/* Score */}
            <p className="text-white text-xs sm:text-sm font-mono">
              Score: {score}
            </p>
          </div>
        </div>

        {/* ── Game canvas ── */}
        <div className="flex-1 min-h-0 px-2 sm:px-4 pb-2 sm:pb-4">
          <div className="relative w-full h-full rounded-xl overflow-hidden border border-neutral-700">
            <canvas ref={canvasRef} className="block w-full h-full" />

            {/* Pause overlay */}
            {paused && !gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p className="text-white text-2xl font-bold">PAUSED</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
