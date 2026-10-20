import { useEffect, useRef, useState } from "react";
import type { ConfigurationOverrides } from "@dashdevil/simulation/config";
import { GameSession, type UISnapshot } from "../game/GameSession";

interface GameWorldProps {
  countdown: 5 | 3;
  seed?: number;
  /** Developer/test overrides captured by the session; no player tuning controls. */
  configuration?: ConfigurationOverrides | (() => ConfigurationOverrides);
  onBack?: () => void;
}

export function GameWorld({ onBack, countdown, configuration, seed }: GameWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const [ui, setUi] = useState<UISnapshot>({
    health: 2,
    maxHealth: 2,
    score: 0,
    status: "countdown",
    paused: false,
    gameOverAnimDone: false,
    countdown,
    accelerating: false,
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const session = new GameSession({ mode: "long-drive", canvas, countdown, configuration, seed });
    sessionRef.current = session;
    setUi(session.getSnapshot());
    const unsubscribe = session.subscribe(() => setUi(session.getSnapshot()));
    session.start();
    return () => {
      unsubscribe();
      session.dispose();
      sessionRef.current = null;
    };
  }, [countdown, configuration, seed]);

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-neutral-950 overflow-hidden">
      <div className="flex flex-col w-[320px] sm:w-160 h-screen max-h-screen overflow-hidden">
        {/* ── Top HUD bar ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-3 shrink-0">
          {/* Left side */}
          <div className="flex flex-col gap-1">
            <h1 className="text-white text-base sm:text-xl tracking-wide">Branding</h1>
            <p className="text-neutral-400 text-xs sm:text-sm">
              {ui.accelerating ? "Accelerating!" : "Hold [Up/W] to accelerate"} Hit [Space] to pause
            </p>
          </div>

          {/* Right side */}
          <div className="flex flex-col items-end gap-1">
            {/* Health hearts */}
            <div
              className="flex gap-1.5 sm:gap-2"
              role="img"
              aria-label={`Health: ${ui.health} of ${ui.maxHealth}`}
            >
              {Array.from({ length: ui.maxHealth }).map((_, i) => (
                <img
                  key={i}
                  src={`${import.meta.env.BASE_URL}textures/heart.png`}
                  alt=""
                  draggable={false}
                  width={16}
                  height={16}
                  style={{ imageRendering: "pixelated" }}
                  className={`w-5 h-5 sm:w-6 sm:h-6 object-contain ${
                    i < ui.health ? "" : "grayscale opacity-30"
                  }`}
                />
              ))}
            </div>

            {/* Score */}
            <p className="text-white text-xs sm:text-sm">Score: {ui.score}</p>
          </div>
        </div>

        {/* ── Game canvas ── */}
        <div className="flex-1 min-h-0 px-2 sm:px-4 pb-2 sm:pb-4">
          <div
            className="relative w-full h-full rounded-xl overflow-hidden border border-neutral-700"
            onPointerDown={(event) => {
              if (!(
                event.target instanceof Element &&
                event.target.closest("button,input,textarea,select,a[href]")
              ))
                sessionRef.current?.focus();
            }}
          >
            <canvas ref={canvasRef} aria-label="Long Drive game" className="block w-full h-full" />

            {/* Countdown overlay */}
            {ui.status === "countdown" && (
              <div
                className="game-overlay absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  backdropFilter: "blur(3px)",
                  WebkitBackdropFilter: "blur(3px)",
                }}
              >
                <DirtBackdrop />
                <p className="font-heading font-light relative text-white text-8xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                  {ui.countdown}
                </p>
              </div>
            )}

            {/* Pause overlay */}
            {ui.paused && ui.status === "playing" && (
              <div
                className="game-overlay absolute inset-0 flex items-center justify-center"
                style={{
                  backdropFilter: "blur(3px)",
                  WebkitBackdropFilter: "blur(3px)",
                }}
              >
                <DirtBackdrop />
                <h2 className="relative text-white text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                  PAUSED
                </h2>
              </div>
            )}

            {/* Game over overlay */}
            {ui.gameOverAnimDone && (
              <div
                className="game-overlay absolute inset-0 flex flex-col items-center justify-center"
                style={{
                  backdropFilter: "blur(3px)",
                  WebkitBackdropFilter: "blur(3px)",
                }}
              >
                <DirtBackdrop />
                <h2 className="relative text-red-500 text-4xl">GAME OVER</h2>
                <p className="relative text-white text-xl mt-4">Score: {ui.score}</p>
                <p className="relative text-neutral-400 text-sm mt-3">Press [Enter] to restart</p>
                {onBack && (
                  <button
                    onClick={() => {
                      sessionRef.current?.command("reset");
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
