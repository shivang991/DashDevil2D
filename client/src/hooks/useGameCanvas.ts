import { useEffect, useRef, useCallback } from "react";
import { GameEngine } from "@/game/engine";
import type { UpdateFn, RenderFn } from "@/game/types";

export function useGameCanvas(update: UpdateFn, render: RenderFn) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const engine = new GameEngine(canvas, update, render);
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
      engineRef.current = null;
      window.removeEventListener("resize", resize);
    };
  }, [update, render]);

  const togglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  return { canvasRef, togglePause, engineRef };
}
