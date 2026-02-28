import { useCallback, useState } from "react";
import { useGameCanvas } from "@/hooks/useGameCanvas";
import { clear, drawRect, drawText } from "@/game/renderer";
import { Button } from "@/components/ui/button";
import type { UpdateFn, RenderFn } from "@/game/types";

// Demo state: a bouncing rectangle
const box = { x: 100, y: 100, w: 40, h: 40, vx: 200, vy: 150 };

const update: UpdateFn = (dt, input) => {
  // Arrow key control
  const speed = 300;
  if (input.isKeyDown("ArrowLeft")) box.vx = -speed;
  if (input.isKeyDown("ArrowRight")) box.vx = speed;
  if (input.isKeyDown("ArrowUp")) box.vy = -speed;
  if (input.isKeyDown("ArrowDown")) box.vy = speed;

  box.x += box.vx * dt;
  box.y += box.vy * dt;
};

const render: RenderFn = (ctx, width, height) => {
  // Bounce off walls
  if (box.x <= 0 || box.x + box.w >= width) {
    box.x = Math.max(0, Math.min(box.x, width - box.w));
    box.vx *= -1;
  }
  if (box.y <= 0 || box.y + box.h >= height) {
    box.y = Math.max(0, Math.min(box.y, height - box.h));
    box.vy *= -1;
  }

  clear(ctx, width, height);
  drawRect(ctx, box.x, box.y, box.w, box.h, "#e94560");
  drawText(ctx, "Arrow keys to steer", 12, 24, "#888", "14px monospace");
};

export function GameScreen() {
  const [paused, setPaused] = useState(false);
  const { canvasRef, togglePause } = useGameCanvas(
    useCallback<UpdateFn>((dt, input) => update(dt, input), []),
    useCallback<RenderFn>((ctx, w, h) => render(ctx, w, h), []),
  );

  const handlePause = () => {
    togglePause();
    setPaused((p) => !p);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div className="absolute top-4 right-4">
        <Button variant="secondary" onClick={handlePause}>
          {paused ? "Resume" : "Pause"}
        </Button>
      </div>
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <p className="text-white text-2xl font-bold">PAUSED</p>
        </div>
      )}
    </div>
  );
}
