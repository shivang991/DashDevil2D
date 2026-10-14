import type { GameState } from "../../../packages/simulation/state";
import { gameConfig } from "./constants";
import { drawRoad, drawCar, drawCoin, drawObstacle, drawGameOver } from "./renderUtils";

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

export function renderLongDrive(
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

