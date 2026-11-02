import { ChatVisibility } from "./Chat";
import { TouchControls } from "./TouchControls";
import { LongDrivePauseMenu } from "./LongDrivePauseMenu";
import { Button } from "./ui/button";
import { ChevronLeft, Pause, Play, RotateCcw } from "lucide-react";
import type { Ref } from "react";
import type { UISnapshot } from "@/game/long-drive/LongDriveSession";

interface GameWorldViewProps {
  ui: UISnapshot;
  canvasRef?: Ref<HTMLCanvasElement>;
  onFocus?: () => void;
  onBack?: () => void;
  onControl?: (control: 1 | 2 | 3, down: boolean) => void;
  onCommand?: (command: "pause" | "reset") => void;
}

/** Presentation only; the owning GameWorld manages the live session. */
export function GameWorldView({
  ui,
  canvasRef,
  onFocus,
  onBack,
  onControl,
  onCommand,
}: GameWorldViewProps) {
  const command = (value: "pause" | "reset") => {
    onCommand?.(value);
    onFocus?.();
  };
  const PauseIcon = ui.paused ? Play : Pause;
  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-neutral-950 p-3 pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))] [@media(max-height:450px)]:p-2">
      <ChatVisibility visible={ui.gameOverAnimDone} playing={!ui.gameOverAnimDone} />
      <section className="game-shell relative flex h-[min(100%,calc(min(560px,100vw_-_48px)*15/14_+_150px))] min-h-0 w-full max-w-[608px] flex-col gap-3 overflow-hidden rounded-[24px] border border-neutral-700 p-[clamp(10px,2vw,22px)] [@media(max-height:450px)]:gap-1 [&_canvas]:touch-none">
        <header className="flex shrink-0 items-center gap-1 sm:gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="size-11 rounded-[10px] text-neutral-300"
              onClick={onBack}
              aria-label="Back"
            >
              <ChevronLeft className="size-6!" aria-hidden="true" />
            </Button>
          )}
          <img
            src={`${import.meta.env.BASE_URL}images/long-drive-logo.png`}
            alt=""
            width={36}
            height={36}
            draggable={false}
            className="size-8 shrink-0 object-contain sm:size-9 [image-rendering:pixelated]"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-sm leading-tight text-red-400 min-[360px]:text-xl sm:text-2xl">
              Long Drive
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs sm:gap-3 text-neutral-200">
              <div
                className="flex gap-1"
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
                    className={`size-4 object-contain [image-rendering:pixelated] ${i < ui.health ? "" : "grayscale opacity-30"}`}
                  />
                ))}
              </div>
              <p className="flex items-center gap-1 tabular-nums" aria-label={`Score: ${ui.score}`}>
                <img
                  src={`${import.meta.env.BASE_URL}textures/coin.png`}
                  alt=""
                  width={14}
                  height={14}
                  className="size-3.5 object-contain [image-rendering:pixelated]"
                />
                <span aria-hidden="true">× {ui.score}</span>
              </p>
            </div>
          </div>
          <div className="shrink-0 border-l border-neutral-700 pl-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 rounded-[10px] text-neutral-300"
              disabled={ui.status !== "playing"}
              aria-label={ui.paused ? "Play" : "Pause"}
              aria-expanded={ui.status === "playing" && ui.paused}
              aria-controls="long-drive-pause"
              onClick={() => command("pause")}
            >
              <PauseIcon className="size-5!" aria-hidden="true" />
            </Button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
          <div
            className="relative aspect-[14/15] max-h-[600px] w-[min(100cqw,calc(100cqh*14/15),560px)] overflow-hidden rounded-xl border border-neutral-600"
            onPointerDown={(event) => {
              if (!(
                event.target instanceof Element &&
                event.target.closest("button,input,textarea,select,a[href]")
              ))
                onFocus?.();
            }}
          >
            <canvas
              ref={canvasRef}
              width={560}
              height={600}
              aria-label="Long Drive game"
              aria-description={ui.accelerating ? "Accelerating" : "Cruising"}
              className="block h-full w-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-400"
            />
            {ui.status === "countdown" && (
              <div
                className="game-overlay pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40"
                role="status"
                aria-label="Countdown"
              >
                <p className="font-heading text-7xl font-light text-white [text-shadow:0_2px_12px_#000]">
                  {ui.countdown}
                </p>
              </div>
            )}
            {ui.paused && ui.status === "playing" && (
              <LongDrivePauseMenu
                onResume={() => command("pause")}
                onRestart={() => command("reset")}
              />
            )}
            {ui.gameOverAnimDone && (
              <div
                className="game-overlay absolute inset-0 flex overflow-auto bg-black/75 p-3 text-center"
                role="region"
                aria-label="Game over"
              >
                <div className="m-auto flex shrink-0 flex-col items-center gap-3">
                  <h2 className="font-heading text-3xl text-red-400">Game over</h2>
                  <p className="text-lg text-white">Score: {ui.score}</p>
                  <Button
                    className="min-h-11 w-36 bg-red-400 text-neutral-950 hover:bg-red-300"
                    onClick={() => command("reset")}
                  >
                    <RotateCcw aria-hidden="true" />
                    Restart
                  </Button>
                  {onBack && (
                    <Button variant="multiplayer" className="min-h-11 w-36" onClick={onBack}>
                      <ChevronLeft aria-hidden="true" />
                      Back to Menu
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {onControl && (
          <TouchControls disabled={ui.status !== "playing" || ui.paused} onControl={onControl} />
        )}
      </section>
    </div>
  );
}
