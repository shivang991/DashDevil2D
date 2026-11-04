import { multiplayerTextButton } from "@/components/ui/styles";
import { CarFlagsNOSActive, ModeRoadRage, SeatFlagsConnected } from "@dashdevil/contracts/protocol";
import { RaceAudio } from "@/game/multiplayer/RaceAudio";
import { Pause, Play, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { TouchControls } from "./TouchControls";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MultiplayerDrivingInput } from "@/game/multiplayer/MultiplayerDrivingInput";
import { countdownReveal, MultiplayerRaceDrawing } from "@/game/multiplayer/MultiplayerRaceDrawing";
import { gameAudio } from "@/lib/gameAudio";
import type { PairedConnection, PairedState } from "@/game/multiplayer/PairedConnection";

type Frame = NonNullable<ReturnType<PairedConnection["frame"]>>;

export function RaceView({
  connection,
  state,
  onLeave,
  suspended: externallySuspended,
  countdown,
  audio = gameAudio,
}: {
  connection: Pick<
    PairedConnection,
    "frame" | "input" | "releaseControls" | "recordDraw" | "recordResultCommit"
  >;
  state: PairedState;
  suspended: boolean;
  countdown?: number;
  onLeave: () => void;
  audio?: Pick<typeof gameAudio, "enabled" | "setEnabled">;
}) {
  const suspended = externallySuspended || countdown !== undefined;
  const intro = useRef({ countdown, startUs: state.startUs, offsetUs: state.clockOffsetUs });
  useLayoutEffect(() => {
    intro.current = { countdown, startUs: state.startUs, offsetUs: state.clockOffsetUs };
  }, [countdown, state.startUs, state.clockOffsetUs]);
  const reducedMotion = useRef(false);
  useLayoutEffect(() => {
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!preference) return;
    const update = () => {
      reducedMotion.current = preference.matches;
    };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  const playback = useRef<RaceAudio | undefined>(undefined);
  const suspendedAudio = useRef(suspended);
  useEffect(() => {
    suspendedAudio.current = suspended;
  }, [suspended]);
  useEffect(() => {
    const player = new RaceAudio();
    playback.current = player;
    return () => {
      player.dispose();
      playback.current = undefined;
    };
  }, [state.roundId]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const driving = useMemo(
    () =>
      new MultiplayerDrivingInput({
        input: (intent, control) => connection.input(intent, control),
        releaseControls: () => connection.releaseControls(),
      }),
    [connection],
  );
  const [menu, setMenu] = useState(false);
  const [frame, setFrame] = useState<Frame>();
  const local = state.identity?.seat ?? 0;
  const context = state.context!;
  useEffect(() => {
    canvas.current?.focus();
    return driving.attach(canvas.current!, {
      menu: () => setMenu((value) => !value),
      mute: () => {
        audio.setEnabled(!audio.enabled);
      },
    });
  }, [driving, audio]);
  useLayoutEffect(() => {
    driving.update({
      menu,
      suspended,
      outcome: state.outcome,
      status: state.status,
      roundId: state.roundId,
    });
    if (!menu && !suspended && !state.outcome && state.status === "Connected")
      canvas.current?.focus();
  }, [driving, menu, suspended, state.outcome, state.status, state.roundId]);
  useEffect(() => {
    let handle = 0,
      lastHud = 0;
    const drawing = new MultiplayerRaceDrawing(context, local);
    const draw = (time: number) => {
      const view = connection.frame();
      if (view && intro.current.countdown === undefined)
        playback.current?.update(view, local, suspendedAudio.current);
      const element = canvas.current,
        ctx = element?.getContext("2d");
      if (view && ctx && element) {
        const { countdown, startUs, offsetUs } = intro.current;
        const reveal =
          countdown === undefined || startUs === undefined
            ? 1
            : countdownReveal(
                startUs - (performance.now() * 1000 + offsetUs),
                reducedMotion.current,
              );
        if (reveal < 1) drawing.draw(ctx, element.width, element.height, view, time, reveal);
        else drawing.draw(ctx, element.width, element.height, view, time);
        connection.recordDraw();
        if (time - lastHud > 40) {
          lastHud = time;
          setFrame(view);
        }
      }
      handle = requestAnimationFrame(draw);
    };
    handle = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(handle);
  }, [connection, context, local]);
  const outcome = state.outcome ?? frame?.outcome;
  useEffect(() => {
    if (outcome) connection.recordResultCommit();
  }, [connection, outcome]);
  const hp = frame?.cars[local].hp ?? context.gameplay.maxHealth;
  const seconds = Math.max(0, Math.ceil(context.gameplay.timeLimit - (frame?.timeUs ?? 0) / 1e6));
  const remaining = Math.max(
    0,
    Math.min(
      100,
      Math.ceil(
        100 *
          (1 -
            (frame?.cars[local].progress ?? 0) /
              (context.gameplay.finishDistance - context.gameplay.carHeight / 2)),
      ),
    ),
  );
  return (
    <div className="race-view relative flex min-h-0 flex-1 flex-col gap-3 [@media(max-height:450px)]:gap-1 [&_canvas]:touch-none">
      <header className="shrink-0 space-y-2">
        <button
          className="grid size-11 place-items-center rounded-[10px] text-neutral-300 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white absolute top-0 right-0"
          aria-label="Pause"
          aria-expanded={menu}
          disabled={countdown !== undefined}
          onClick={() => {
            driving.reset();
            setMenu((value) => !value);
          }}
        >
          <Pause size={22} aria-hidden="true" />
        </button>
        <div className="flex items-center justify-between gap-3">
          <h1 className="pr-12 text-3xl font-heading text-red-400">
            {context.mode === ModeRoadRage ? "Road Rage" : "Drag Race"}
          </h1>
          <span
            className="sr-only"
            data-testid={`hp-${local}`}
            aria-label={`Your HP: ${hp} of ${context.gameplay.maxHealth}`}
          >
            HP {hp}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-neutral-400">
          <p className="flex min-w-0 gap-2">
            <span className="truncate" title={state.room?.seats[local].name}>
              {state.room?.seats[local].name}
            </span>
            <span className="text-neutral-600">vs</span>
            <span className="truncate" title={state.room?.seats[1 - local].name}>
              {state.room?.seats[1 - local].name}
            </span>
          </p>
          <p
            className="mr-[11px] shrink-0 text-base text-white tabular-nums"
            data-testid={context.mode === ModeRoadRage ? "time-remaining" : "distance-remaining"}
          >
            {context.mode === ModeRoadRage
              ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
              : `${remaining}% left`}
          </p>
        </div>
      </header>
      <span className="sr-only" data-testid={`hp-${1 - local}`}>
        HP {frame?.cars[1 - local].hp ?? context.gameplay.maxHealth}
      </span>
      <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
        <div className="relative aspect-[14/15] max-h-[600px] w-[min(100cqw,calc(100cqh*14/15),560px)]">
          <span
            hidden
            data-testid="nos-status"
            data-nos-state={
              (frame?.cars[local].flags ?? 0) & CarFlagsNOSActive ? "active" : "ready"
            }
          />

          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col items-center gap-2 text-center text-xs">
            {countdown === undefined && frame?.awaiting && !outcome && (
              <p role="status" className="bg-black/80 p-2">
                Awaiting confirmation
              </p>
            )}
            {!((state.room?.seats[1 - local]?.flags ?? 0) & SeatFlagsConnected) && !outcome && (
              <p role="status" className="bg-black/80 p-2">
                Opponent disconnected—round continues.
              </p>
            )}
            {((countdown === undefined && frame?.stale) || state.status !== "Connected") &&
              !outcome && (
                <p role="alert" className="bg-black/80 p-2">
                  Reconnecting
                </p>
              )}
            {state.pending && (
              <p role="status" className="bg-black/80 p-2">
                {state.pending}…
              </p>
            )}
            {state.notice && (
              <p role="alert" className="bg-black/80 p-2">
                {state.notice}
              </p>
            )}
          </div>
          {countdown !== undefined && (
            <div
              className="pt-[6%] [text-shadow:0_2px_12px_#000,0_0_32px_#000] pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-start text-center"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <p
                className="pt-0 pb-2 text-center font-heading text-[clamp(48px,18cqw,104px)] leading-none font-light"
                data-testid="countdown"
              >
                {countdown}
              </p>
              <p className="text-sm text-white">Get ready!</p>
              <button className={`${multiplayerTextButton} pointer-events-auto`} onClick={onLeave}>
                Leave
              </button>
            </div>
          )}
          <canvas
            ref={canvas}
            width={560}
            height={600}
            tabIndex={0}
            role="img"
            aria-label="Multiplayer race"
            className="block h-full w-full rounded-xl border border-neutral-600 focus:outline-2 focus:outline-red-400"
          />
        </div>
      </div>
      <TouchControls
        disabled={menu || suspended || Boolean(outcome) || state.status !== "Connected"}
        onControl={(control, down) => {
          if (down) canvas.current?.focus({ preventScroll: true });
          if (down) driving.press(`touch:${control}`, control);
          else driving.release(`touch:${control}`);
        }}
      />
      {menu && !outcome && (
        <div
          role="dialog"
          aria-label="Race menu"
          className="game-overlay absolute inset-0 z-30 flex overflow-auto bg-black/65 p-3"
        >
          <div className="m-auto flex w-36 shrink-0 flex-col gap-2">
            <Button
              autoFocus
              className="min-h-11 bg-red-400 text-neutral-950 hover:bg-red-300"
              onClick={() => setMenu(false)}
            >
              <Play aria-hidden="true" />
              Resume
            </Button>
            <Button variant="multiplayer" className="min-h-11" onClick={onLeave}>
              <LogOut aria-hidden="true" />
              Leave
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
