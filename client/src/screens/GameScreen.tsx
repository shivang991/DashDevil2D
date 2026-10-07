import { useRef } from "react";
import { useGameInput } from "@/hooks/useGameInput";
import { useGameContext } from "@/hooks/useGameContext";
import { useGameLoop } from "@/hooks/useGameLoop";
import { gameConfig } from "@/lib/constants";

interface GameScreenProps {
  onBack?: () => void;
}

export function GameScreen({ onBack }: GameScreenProps) {
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
            <h1 className="text-white text-base sm:text-xl tracking-wide">
              Branding
            </h1>
            <p className="text-neutral-400 text-xs sm:text-sm">
              Accelerating! Hit [Space] to pause
            </p>
          </div>

          {/* Right side */}
          <div className="flex flex-col items-end gap-1">
            {/* Health hearts */}
            <div
              className="flex gap-1.5 sm:gap-2"
              role="img"
              aria-label={`Health: ${gameContext.gameState.health} of ${gameConfig.maxHealth}`}
            >
              {Array.from({ length: gameConfig.maxHealth }).map((_, i) => (
                <img
                  key={i}
                  src={`${import.meta.env.BASE_URL}textures/heart.png`}
                  alt=""
                  draggable={false}
                  width={16}
                  height={16}
                  style={{ imageRendering: "pixelated" }}
                  className={`w-5 h-5 sm:w-6 sm:h-6 object-contain ${
                    i < gameContext.gameState.health
                      ? ""
                      : "grayscale opacity-30"
                  }`}
                />
              ))}
            </div>

            {/* Score */}
            <p className="text-white text-xs sm:text-sm">
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
              <div
                className="game-overlay absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  backdropFilter: "blur(3px)",
                  WebkitBackdropFilter: "blur(3px)",
                }}
              >
                <DirtBackdrop />
                <p className="font-heading font-light relative text-white text-8xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                  {Math.ceil(gameContext.gameState.countdownTimer)}
                </p>
              </div>
            )}

            {/* Pause overlay */}
            {gameContext.gameState.paused &&
              gameContext.gameState.status === "playing" && (
                <div
                  className="game-overlay absolute inset-0 flex items-center justify-center"
                  style={{
                    backdropFilter: "blur(3px)",
                    WebkitBackdropFilter: "blur(3px)",
                  }}
                >
                  <DirtBackdrop />
                  <h2 className="relative text-white text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">PAUSED</h2>
                </div>
              )}

            {/* Game over overlay */}
            {gameContext.gameState.gameOverAnimDone && (
              <div
                className="game-overlay absolute inset-0 flex flex-col items-center justify-center"
                style={{
                  backdropFilter: "blur(3px)",
                  WebkitBackdropFilter: "blur(3px)",
                }}
              >
                <DirtBackdrop />
                <h2 className="relative text-red-500 text-4xl">
                  GAME OVER
                </h2>
                <p className="relative text-white text-xl mt-4">
                  Score: {gameContext.gameState.score}
                </p>
                <p className="relative text-neutral-400 text-sm mt-3">
                  Press [Enter] to restart
                </p>
                {onBack && (
                  <button
                    onClick={() => {
                      gameContext.resetGameState();
                      onBack();
                    }}
                    className="relative mt-6 px-4 py-2 rounded-lg border border-neutral-600 text-neutral-300 text-sm hover:border-neutral-400 hover:text-white transition-colors"
                  >
                    Back to Menu
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DirtBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-[#49301f] opacity-60"
      style={{
        backgroundImage: `url(${import.meta.env.BASE_URL}textures/dirt.png)`,
        backgroundRepeat: "repeat",
        backgroundSize: "64px 64px",
        imageRendering: "pixelated",
      }}
    />
  );
}
