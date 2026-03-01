import type { GameStateManager } from "./state";

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
  state: GameStateManager,
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

  // Road edges (white solid lines)
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

  // Lane dividers (dashed, animated)
  const laneWidth = roadWidth / state.laneCount;
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 2;
  ctx.setLineDash([30, 20]);
  ctx.lineDashOffset = -state.roadOffset;

  for (let i = 1; i < state.laneCount; i++) {
    const x = roadLeft + laneWidth * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

export function drawCar(
  ctx: CanvasRenderingContext2D,
  state: GameStateManager,
  width: number,
) {
  const cx = state.laneX(state.currentLane, width);
  const x = cx - state.carWidth / 2;
  const y = state.carY;
  const w = state.carWidth;
  const h = state.carHeight;

  // Car body
  ctx.fillStyle = "#2196f3";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();

  // Windshield
  ctx.fillStyle = "#90caf9";
  ctx.fillRect(x + 8, y + 12, w - 16, 18);

  // Rear window
  ctx.fillStyle = "#90caf9";
  ctx.fillRect(x + 10, y + h - 28, w - 20, 14);

  // Wheels
  ctx.fillStyle = "#222";
  ctx.fillRect(x - 4, y + 10, 6, 16);
  ctx.fillRect(x + w - 2, y + 10, 6, 16);
  ctx.fillRect(x - 4, y + h - 26, 6, 16);
  ctx.fillRect(x + w - 2, y + h - 26, 6, 16);
}

export function drawCoin(
  ctx: CanvasRenderingContext2D,
  state: GameStateManager,
  coinX: number,
  coinY: number,
  coinSize: number,
) {
  void state; // available for future use
  const radius = coinSize / 2;

  // Outer circle
  ctx.fillStyle = "#ffd700";
  ctx.beginPath();
  ctx.arc(coinX, coinY + radius, radius, 0, Math.PI * 2);
  ctx.fill();

  // Inner dollar sign
  ctx.fillStyle = "#b8860b";
  ctx.font = `bold ${Math.floor(coinSize * 0.6)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", coinX, coinY + radius);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  _state: GameStateManager,
  ox: number,
  oy: number,
  ow: number,
  oh: number,
) {
  // Red barrier / crate
  ctx.fillStyle = "#e53935";
  ctx.beginPath();
  ctx.roundRect(ox - ow / 2, oy, ow, oh, 4);
  ctx.fill();

  // X marking
  ctx.strokeStyle = "#ffcdd2";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ox - ow / 2 + 6, oy + 6);
  ctx.lineTo(ox + ow / 2 - 6, oy + oh - 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ox + ow / 2 - 6, oy + 6);
  ctx.lineTo(ox - ow / 2 + 6, oy + oh - 6);
  ctx.stroke();
}

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: GameStateManager,
  width: number,
) {
  // Score
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px monospace";
  ctx.fillText(`Score: ${state.score}`, 16, 32);

  // Health hearts
  const heartSize = 22;
  const heartGap = 6;
  const totalWidth =
    state.maxHealth * heartSize + (state.maxHealth - 1) * heartGap;
  const startX = width - totalWidth - 16;

  for (let i = 0; i < state.maxHealth; i++) {
    const hx = startX + i * (heartSize + heartGap);
    ctx.font = `${heartSize}px serif`;
    ctx.fillStyle = i < state.health ? "#e53935" : "#555";
    ctx.fillText("♥", hx, 34);
  }
}

export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  state: GameStateManager,
  width: number,
  height: number,
) {
  // Dim overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(0, 0, width, height);

  // Game over text
  ctx.fillStyle = "#e53935";
  ctx.font = "bold 48px monospace";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", width / 2, height / 2 - 30);

  // Score
  ctx.fillStyle = "#ffffff";
  ctx.font = "24px monospace";
  ctx.fillText(`Score: ${state.score}`, width / 2, height / 2 + 20);

  ctx.textAlign = "start";
}
