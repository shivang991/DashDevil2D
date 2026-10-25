import type { GameState } from "@dashdevil/simulation/state";
import { gameConfig as defaultConfig, type GameConfig } from "./constants";
import { drawRoad, drawCar, drawCoin, drawHeart, drawObstacle, drawGameOver } from "./renderUtils";

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
  gameConfig: GameConfig = defaultConfig,
): void {
  const needsTransform = state.shakeOffsetX !== 0 || state.shakeOffsetY !== 0;
  if (needsTransform) {
    ctx.save();
    ctx.translate(state.shakeOffsetX, state.shakeOffsetY);
  }

  drawRoad(ctx, state, gameConfig, width, height);
  const objectY = (object: GameState["coins"][number]) =>
    object.distance === undefined
      ? object.y
      : state.carYBase +
        gameConfig.carHeight / 2 -
        (object.distance - state.roadOffset) -
        object.height / 2;

  for (const coin of state.coins) {
    const cx = laneX(coin.lane, width, state.roadWidthRatio, gameConfig.laneCount);
    drawCoin(ctx, cx, objectY(coin), coin.width);
  }

  for (const heart of state.hearts) {
    drawHeart(
      ctx,
      laneX(heart.lane, width, state.roadWidthRatio, gameConfig.laneCount),
      objectY(heart),
      heart.width,
    );
  }

  for (const obs of state.obstacles) {
    const ox = laneX(obs.lane, width, state.roadWidthRatio, gameConfig.laneCount);
    drawObstacle(ctx, ox, objectY(obs), obs.width, obs.height);
  }

  if (state.carVisible) {
    const carX = laneX(state.visualLane, width, state.roadWidthRatio, gameConfig.laneCount);
    drawCar(ctx, carX, state, gameConfig);
  }

  if (needsTransform) {
    ctx.restore();
  }

  if (state.status === "gameover") {
    drawGameOver(ctx, state, width, height);
  }
}
