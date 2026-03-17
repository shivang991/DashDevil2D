import { useRef } from "react";
import { useGameInput } from "@/hooks/useGameInput";
import { useGameContext } from "@/hooks/useGameContext";
import { useGameLoop } from "@/hooks/useGameLoop";
import { gameConfig } from "@/lib/constants";

export function GameScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameInput = useGameInput();
  const gameContext = useGameContext();

  useGameLoop({ canvasRef, gameContext, gameInput });

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
              {Array.from({ length: gameConfig.maxHealth }).map((_, i) => (
                <div
                  key={i}
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 ${
                    i < gameContext.gameState.health
                      ? "bg-red-500 border-red-400"
                      : "bg-transparent border-neutral-600"
                  }`}
                />
              ))}
            </div>

            {/* Score */}
            <p className="text-white text-xs sm:text-sm font-mono">
              Score: {gameContext.gameState.score}
            </p>
          </div>
        </div>

        {/* ── Game canvas ── */}
        <div className="flex-1 min-h-0 px-2 sm:px-4 pb-2 sm:pb-4">
          <div className="relative w-full h-full rounded-xl overflow-hidden border border-neutral-700">
            <canvas ref={canvasRef} className="block w-full h-full" />

            {/* Countdown overlay */}
            {gameContext.gameState.status === "countdown" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
                <p className="text-white text-8xl font-bold font-mono">
                  {Math.ceil(gameContext.gameState.countdownTimer)}
                </p>
              </div>
            )}

            {/* Pause overlay */}
            {gameContext.gameState.paused &&
              gameContext.gameState.status === "playing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <p className="text-white text-2xl font-bold">PAUSED</p>
                </div>
              )}

            {/* Game over overlay */}
            {gameContext.gameState.gameOverAnimDone && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-red-500 text-4xl font-bold font-mono">
                  GAME OVER
                </p>
                <p className="text-white text-xl font-mono mt-4">
                  Score: {gameContext.gameState.score}
                </p>
                <p className="text-neutral-400 text-sm font-mono mt-3">
                  Press [Enter] to restart
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
