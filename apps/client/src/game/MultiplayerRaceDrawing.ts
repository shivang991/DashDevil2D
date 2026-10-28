import type { Context } from "@dashdevil/contracts/protocol";
import type { RaceSession } from "./RaceSession";
import { drawRoadScenery, drawSprite } from "@/lib/renderUtils";
import { multiplayerRoadScale } from "@/lib/roadProjection";

type DrawingFrame = Pick<ReturnType<RaceSession["frame"]>, "cars" | "renderedCars" | "objects">;

/** One instance per drawing lifetime; replacing it clears damage cue history. */
export class MultiplayerRaceDrawing {
  private readonly previousHp: number[] = [];
  private readonly hitAt = [-Infinity, -Infinity];
  private readonly context: Context;
  private readonly local: number;

  constructor(context: Context, local: number) {
    this.context = context;
    this.local = local;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    view: DrawingFrame,
    time: number,
  ): void {
    const { context, local } = this;
    const g = context.gameplay,
      scale = width / (g.laneSpacing * 3.9);
    const camera = view.renderedCars[local].progress;
    const roadScale = multiplayerRoadScale(
      scale,
      height,
      g.maxRoadSpeed * g.accelSpeedMultiplier + g.carHeight / 2,
    );
    const y = (progress: number) => height * 0.76 - (progress - camera) * roadScale;
    drawRoadScenery(
      ctx,
      width,
      height,
      g.laneSpacing * 3 * scale,
      3,
      height * 0.76 + camera * roadScale,
      context.seed,
    );
    ctx.textAlign = "left";
    const finishY = y(g.finishDistance);
    if (context.mode === 1 && finishY > -30 && finishY < height + 30) {
      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(0, finishY - 6, width, 12);
      ctx.font = "18px sans-serif";
      ctx.fillText("FINISH", 12, finishY - 18);
    }
    for (const object of view.objects) {
      const kind = object.flags & 3;
      if (object.flags & (kind === 2 ? 8 << local : 4)) continue;
      const x = width / 2 + (object.lane - 1) * g.laneSpacing * scale,
        cy = y(object.distance);
      const ow = (kind === 2 ? g.obstacleW : kind === 1 ? g.coinSize : g.heartSize) * scale;
      const oh = (kind === 2 ? g.obstacleH : kind === 1 ? g.coinSize : g.heartSize) * roadScale;
      if (cy < -oh || cy > height + oh) continue;
      if (
        drawSprite(
          ctx,
          kind === 2 ? "barrier" : kind === 3 ? "heart" : "coin",
          x - ow / 2,
          cy - oh / 2,
          ow,
          oh,
        )
      )
        continue;
      ctx.fillStyle = kind === 2 ? "#f59e0b" : kind === 3 ? "#fb7185" : "#fde047";
      if (kind === 2) {
        ctx.fillRect(x - ow / 2, cy - oh / 2, ow, oh);
        ctx.fillStyle = "#171b24";
        ctx.fillRect(x - ow / 2, cy - oh / 8, ow, oh / 4);
      } else {
        ctx.font = `${ow}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(kind === 3 ? "♥" : "●", x, cy + oh / 3);
      }
    }
    view.renderedCars.forEach((car, seat) => {
      const hp = view.cars[seat].hp;
      if (this.previousHp[seat] !== undefined && hp < this.previousHp[seat])
        this.hitAt[seat] = time;
      this.previousHp[seat] = hp;
      const elapsed = (time - this.hitAt[seat]) / 1000;
      const presentation = context.presentation;
      const shake =
        elapsed < presentation.shakeDuration
          ? presentation.shakeIntensity * (1 - elapsed / presentation.shakeDuration)
          : 0;
      // Drag Race has no protection, but still needs a visible damage cue.
      const blinkDuration = g.invincibleDuration || 2;
      const visible =
        elapsed >= blinkDuration ||
        presentation.blinkCount === 0 ||
        Math.floor((elapsed * presentation.blinkCount * 2) / blinkDuration) % 2 === 0;
      const x = width / 2 + car.lateral * scale + (Math.random() - 0.5) * shake,
        cy = y(car.progress) + (Math.random() - 0.5) * shake;
      const carWidth = g.carWidth * scale,
        carHeight = g.carHeight * roadScale;
      ctx.save();
      ctx.translate(x, cy);
      ctx.rotate(car.tilt);
      ctx.translate(-x, -cy);
      const drawn =
        !visible ||
        drawSprite(
          ctx,
          seat === local ? "car" : "car-rival",
          x - carWidth / 2,
          cy - carHeight / 2,
          carWidth,
          carHeight,
        );
      if (!drawn) {
        ctx.fillStyle = seat === local ? "#2196f3" : "#e74656";
        ctx.fillRect(x - carWidth / 2, cy - carHeight / 2, carWidth, carHeight);
      }
      ctx.restore();
      if (seat !== local) {
        const hp = view.cars[seat].hp;
        const barWidth = Math.max(64, carWidth);
        const offscreen = cy - carHeight / 2 < 30 || cy + carHeight / 2 > height;
        const barY = Math.max(30, Math.min(height - 64, cy - carHeight / 2 - 18));
        const barX = Math.max(8, Math.min(width - barWidth - 8, x - barWidth / 2));
        ctx.fillStyle = "#171717";
        ctx.fillRect(barX - 2, barY - 2, barWidth + 4, 12);
        ctx.fillStyle = "#fb7185";
        ctx.fillRect(barX, barY, barWidth * Math.max(0, Math.min(1, hp / g.maxHealth)), 8);
        if (offscreen) {
          ctx.fillStyle = "#fff";
          ctx.font = "14px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(cy < height / 2 ? "▲ Rival" : "▼ Rival", barX + barWidth / 2, barY - 8);
        }
      }
      ctx.fillStyle = "white";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(seat === local ? "You" : "Rival", x, cy + (g.carHeight * roadScale) / 2 + 20);
    });
  }
}
