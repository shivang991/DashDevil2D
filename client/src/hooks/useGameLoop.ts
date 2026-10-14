import { advanceLongDrive, type LongDrive } from "../../../packages/simulation/longDrive";
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

// ── Render — pure canvas drawing, no state mutation ──

function render(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: Readonly<GameState>,
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

    const simulation: LongDrive = { state: gameContext.gameState, random: () => Math.random(), time: 0, eventId: 0 };
    let animationId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, gameConfig.maxDeltaTime);
      lastTime = now;

      const state = simulation.state;
      const events = advanceLongDrive(simulation, dt, {
        steering: gameInput.isSteeringLeft() ? "left" : gameInput.isSteeringRight() ? "right" : undefined,
        accelerating: gameInput.isAccelerating(),
        pause: state.status === "playing" ? gameInput.popPauseToggle() : false,
        restart: state.status === "gameover" && state.gameOverAnimDone ? gameInput.popRestartToggle() : false,
      });
      if (events.some(event => event.type === "gameover")) gameInput.popRestartToggle();
      if (state.status === "countdown" && events.length === 0) gameInput.popRestartToggle();
      gameContext.updateGameState({ score: state.score, health: state.health, status: state.status, paused: state.paused, gameOverAnimDone: state.gameOverAnimDone, countdownTimer: state.countdownTimer });
      gameAudio.update(state, events);

      const ctx = canvas.getContext("2d");
      if (ctx) {
        render(ctx, canvas.width, canvas.height, gameContext.gameState);
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);


    return () => {
      cancelAnimationFrame(animationId);
      gameAudio.stop();
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef, gameContext, gameInput]);
}
