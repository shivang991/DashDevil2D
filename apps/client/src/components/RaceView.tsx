import {
  CarFlagsNOSActive,
  ControlLeft,
  ControlNOS,
  ControlRight,
  ModeRoadRage,
  SeatFlagsConnected,
} from "@dashdevil/contracts/protocol";
import { RaceAudio } from "@/game/RaceAudio";
import { Settings } from "lucide-react";
import { TouchControls } from "./TouchControls";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MultiplayerDrivingInput, type DrivingControl } from "@/game/MultiplayerDrivingInput";
import { countdownReveal, MultiplayerRaceDrawing } from "@/game/MultiplayerRaceDrawing";
import { gameAudio } from "@/lib/gameAudio";
import type { PairedConnection, PairedState } from "@/transport/PairedConnection";

const controls: Record<string, DrivingControl> = {
  ArrowLeft: ControlLeft,
  a: ControlLeft,
  A: ControlLeft,
  ArrowRight: ControlRight,
  d: ControlRight,
  D: ControlRight,
  ArrowUp: ControlNOS,
  w: ControlNOS,
  W: ControlNOS,
};
const controlFor = (key: string) => controls[key];
const interactive = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(target.closest('button,input,select,textarea,a,[contenteditable="true"]'));
const button = "rounded-lg border border-neutral-600 px-4 py-2 hover:bg-neutral-800";
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
  const { pressed, driving } = useMemo(() => {
    const pressed = new Set<string>();
    const driving = new MultiplayerDrivingInput(
      {
        input: (intent, control) => connection.input(intent, control),
        releaseControls: () => connection.releaseControls(),
      },
      () => pressed.clear(),
    );
    return { pressed, driving };
  }, [connection]);
  const [muted, setMuted] = useState(!audio.enabled);
  const [menu, setMenu] = useState(false);
  const [frame, setFrame] = useState<Frame>();
  const local = state.identity?.seat ?? 0;
  const context = state.context!;
  useEffect(() => {
    canvas.current?.focus();
    return () => driving.reset();
  }, [driving]);
  useEffect(() => {
    const release = () => driving.reset();
    const down = (event: KeyboardEvent) => {
      if (event.repeat || pressed.has(event.code)) return;
      pressed.add(event.code);
      if (suspended || state.outcome) return;
      if (
        (event.key === "Escape" && (menu || !interactive(event.target))) ||
        (event.code === "Space" && !interactive(event.target))
      ) {
        event.preventDefault();
        driving.reset();
        setMenu((value) => !value);
        return;
      }
      if (event.key.toLowerCase() === "m" && !interactive(event.target)) {
        audio.setEnabled(!audio.enabled);
        setMuted(!audio.enabled);
        return;
      }
      const control = controlFor(event.key);
      if (control && !interactive(event.target) && document.hasFocus() && !document.hidden) {
        if (driving.press(`key:${event.code}`, control)) event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => {
      pressed.delete(event.code);
      if (suspended) return;
      const control = controlFor(event.key);
      if (control && driving.release(`key:${event.code}`)) {
        if (!interactive(event.target)) event.preventDefault();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
    };
  }, [driving, pressed, menu, suspended, state.outcome, audio]);
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
    <div className="race-view">
      <header className="shrink-0 space-y-2 pr-12">
        <button
          className="settings-trigger absolute top-0 right-0"
          aria-label="Settings"
          aria-expanded={menu}
          disabled={countdown !== undefined}
          onClick={() => {
            driving.reset();
            setMenu((value) => !value);
          }}
        >
          <Settings size={22} aria-hidden="true" />
        </button>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-heading text-red-400">
            {context.mode === ModeRoadRage ? "Road Rage" : "Drag Race"}
          </h1>
          <div
            className="flex gap-1"
            data-testid={`hp-${local}`}
            aria-label={`Your HP: ${hp} of ${context.gameplay.maxHealth}`}
          >
            {context.gameplay.maxHealth <= 8 && <span className="sr-only">HP {hp}</span>}
            {context.gameplay.maxHealth > 8 ? (
              <span>
                ♥ {hp}/{context.gameplay.maxHealth}
              </span>
            ) : (
              Array.from({ length: context.gameplay.maxHealth }, (_, heart) => (
                <img
                  key={heart}
                  src={`${import.meta.env.BASE_URL}textures/heart.png`}
                  alt=""
                  width={22}
                  height={22}
                  style={{ imageRendering: "pixelated" }}
                  className={heart < hp ? "object-contain" : "object-contain grayscale opacity-30"}
                />
              ))
            )}
          </div>
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
            className="shrink-0 text-base text-white tabular-nums"
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
      <div className="race-stage">
        <div className="race-canvas-wrap">
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
                  Reconnecting—round continues.
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
              className="race-countdown pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-start text-center"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="multiplayer-countdown" data-testid="countdown">
                {countdown}
              </p>
              <p className="text-sm text-white">Get ready!</p>
              <button className="multiplayer-text-button pointer-events-auto" onClick={onLeave}>
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
            onBlur={() => driving.reset()}
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
        <div role="dialog" aria-label="Race menu" className="settings-panel race-settings-panel">
          <p>The round continues.</p>
          <button autoFocus className={button} onClick={() => setMenu(false)}>
            Resume
          </button>
          <button
            className={button}
            onClick={() => {
              audio.setEnabled(muted);
              setMuted(!muted);
            }}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button className={button} onClick={onLeave}>
            Leave
          </button>
        </div>
      )}
    </div>
  );
}
