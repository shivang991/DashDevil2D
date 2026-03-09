import type { GameState } from "@/hooks/useGameContext";
import { type GameConfig } from "@/lib/constants";

// ── Generic helpers ──

export function clear(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color = "#1a1a2e",
) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

export function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = "#ffffff",
  font = "16px monospace",
) {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.fillText(text, x, y);
}

// ── Road runner game rendering ──

export function drawRoad(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  config: GameConfig,
  width: number,
  height: number,
) {
  const roadWidth = width * state.roadWidthRatio;
  const roadLeft = (width - roadWidth) / 2;

  // Grass
  ctx.fillStyle = "#2d5a27";
  ctx.fillRect(0, 0, width, height);

  // Road surface
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(roadLeft, 0, roadWidth, height);

  // Road edges
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(roadLeft, 0);
  ctx.lineTo(roadLeft, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(roadLeft + roadWidth, 0);
  ctx.lineTo(roadLeft + roadWidth, height);
  ctx.stroke();

  // Lane dividers — thick solid rectangles scrolling downward
  const laneWidth = roadWidth / config.laneCount;
  const dividerW = 16;
  const segmentH = 40;
  const gapH = 20;
  const period = segmentH + gapH;
  const offset = state.roadOffset % period;

  ctx.fillStyle = "#cccccc";
  for (let i = 1; i < config.laneCount; i++) {
    const x = roadLeft + laneWidth * i - dividerW / 2;
    for (let y = -period + offset; y < height; y += period) {
      ctx.fillRect(x, y, dividerW, segmentH);
    }
  }
}

export function drawCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  state: GameState,
  config: GameConfig,
) {
  const centerY = state.carY + config.carHeight / 2;

  ctx.save();
  ctx.translate(cx, centerY);
  ctx.rotate(state.carTilt);

  // Simple rectangle — will be replaced with sprite
  ctx.fillStyle = "#2196f3";
  ctx.fillRect(
    -config.carWidth / 2,
    -config.carHeight / 2,
    config.carWidth,
    config.carHeight,
  );

  ctx.restore();
}

export function drawCoin(
  ctx: CanvasRenderingContext2D,
  coinX: number,
  coinY: number,
  size: number,
) {
  // Simple yellow circle
  const radius = size / 2;
  ctx.fillStyle = "#ffd700";
  ctx.beginPath();
  ctx.arc(coinX, coinY + radius, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  ow: number,
  oh: number,
) {
  // Simple red rectangle
  ctx.fillStyle = "#e53935";
  ctx.fillRect(ox - ow / 2, oy, ow, oh);
}

export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
) {
  ctx.fillStyle = `rgba(0, 0, 0, ${state.gameOverFadeAlpha})`;
  ctx.fillRect(0, 0, width, height);
}
