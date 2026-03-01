import { useCallback, useState, useRef } from "react";
import { useGameCanvas } from "@/hooks/useGameCanvas";
import {
  drawRoad,
  drawCar,
  drawCoin,
  drawObstacle,
  drawHUD,
  drawGameOver,
} from "@/game/renderer";
import { GameStateManager } from "@/game/state";
import { Button } from "@/components/ui/button";
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

    // ── Scroll road ──
    state.roadOffset += state.roadSpeed * dt;

    // ── Move objects downward ──
    for (const obj of state.coins) obj.y += state.roadSpeed * dt;
    for (const obj of state.obstacles) obj.y += state.roadSpeed * dt;

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

    // ── Collision detection (lane + Y overlap) ──
    const carTop = state.carY;
    const carBottom = state.carY + state.carHeight;

    state.coins = state.coins.filter((coin) => {
      if (coin.lane === state.currentLane) {
        const objTop = coin.y;
        const objBottom = coin.y + coin.height;
        if (objBottom >= carTop && objTop <= carBottom) {
          state.score += 10;
          return false;
        }
      }
      return true;
    });

    state.obstacles = state.obstacles.filter((obs) => {
      if (obs.lane === state.currentLane) {
        const objTop = obs.y;
        const objBottom = obs.y + obs.height;
        if (objBottom >= carTop && objTop <= carBottom) {
          state.health--;
          if (state.health <= 0) {
            state.status = "gameover";
          }
          return false;
        }
      }
      return true;
    });

    // ── Remove off-screen objects ──
    // We use a generous bottom bound; actual canvas height checked in render
    state.coins = state.coins.filter((c) => c.y < 2000);
    state.obstacles = state.obstacles.filter((o) => o.y < 2000);
  };
}

function createRender(state: GameStateManager): RenderFn {
  return (ctx, width, height) => {
    // Initialize carY on first render if not set
    if (state.carY === 0) {
      state.carY = height - state.carHeight - 40;
    }

    drawRoad(ctx, state, width, height);

    // Draw coins
    for (const coin of state.coins) {
      const cx = state.laneX(coin.lane, width);
      drawCoin(ctx, state, cx, coin.y, coin.width);
    }

    // Draw obstacles
    for (const obs of state.obstacles) {
      const ox = state.laneX(obs.lane, width);
      drawObstacle(ctx, state, ox, obs.y, obs.width, obs.height);
    }

    drawCar(ctx, state, width);
    drawHUD(ctx, state, width);

    if (state.status === "gameover") {
      drawGameOver(ctx, state, width, height);
    }
  };
}

export function GameScreen() {
  const stateRef = useRef(new GameStateManager());
  const state = stateRef.current;

  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const update = useCallback<UpdateFn>(
    (dt, input) => {
      createUpdate(state)(dt, input);
      // Sync React state for overlay
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

  const handlePause = () => {
    if (state.status === "gameover") return;
    togglePause();
    setPaused((p) => !p);
  };

  const handleRestart = () => {
    const canvas = canvasRef.current;
    state.reset(canvas ? canvas.height : 600);
    setGameOver(false);
    setPaused(false);
    // Make sure engine is running
    if (engineRef.current?.paused) {
      engineRef.current.togglePause();
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Pause button (hidden during game over) */}
      {!gameOver && (
        <div className="absolute top-4 right-4">
          <Button variant="secondary" onClick={handlePause}>
            {paused ? "Resume" : "Pause"}
          </Button>
        </div>
      )}

      {/* Pause overlay */}
      {paused && !gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <p className="text-white text-2xl font-bold">PAUSED</p>
        </div>
      )}

      {/* Game over overlay */}
      {gameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
          {/* The canvas already draws the dim overlay + text, so just add the button */}
          <div className="mt-24">
            <Button size="lg" onClick={handleRestart}>
              Restart
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
