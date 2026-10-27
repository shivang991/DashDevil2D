import { Settings } from "lucide-react";
import { TouchControls } from "./TouchControls";
import { useCallback, useEffect, useRef, useState } from "react";
import { drawRoadScenery, drawSprite } from "@/lib/renderUtils";
import { multiplayerRoadScale } from "@/lib/roadProjection";
import { RoundResult } from "./RoundResult";
import { gameAudio } from "@/lib/gameAudio";
import type { PairedConnection, PairedState } from "@/transport/PairedConnection";

const controlFor = (key: string) =>
  ({ ArrowLeft: 1, a: 1, A: 1, ArrowRight: 2, d: 2, D: 2, ArrowUp: 3, w: 3, W: 3 })[key];
const interactive = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(target.closest('button,input,select,textarea,a,[contenteditable="true"]'));
const button = "rounded-lg border border-neutral-600 px-4 py-2 hover:bg-neutral-800";
type Frame = NonNullable<ReturnType<PairedConnection["frame"]>>;

export function RaceView({
  connection,
  state,
  onLeave,
  suspended,
  audio = gameAudio,
}: {
  connection: Pick<
    PairedConnection,
    "frame" | "input" | "releaseControls" | "recordDraw" | "recordResultCommit"
  >;
  state: PairedState;
  suspended: boolean;
  onLeave: () => void;
  audio?: Pick<typeof gameAudio, "enabled" | "setEnabled">;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pressed = useRef(new Set<string>());
  const sources = useRef(new Map<string, number>());
  const controlInput = useCallback(
    (source: string, control: number, down: boolean) => {
      const wasHeld = [...sources.current.values()].includes(control);
      if (down) sources.current.set(source, control);
      else sources.current.delete(source);
      const isHeld = [...sources.current.values()].includes(control);
      if (wasHeld !== isHeld) connection.input(isHeld ? 0 : 1, control);
    },
    [connection],
  );
  const [muted, setMuted] = useState(!audio.enabled);
  const [menu, setMenu] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [frame, setFrame] = useState<Frame>();
  const local = state.identity?.seat ?? 0;
  const context = state.context!;
  useEffect(() => {
    canvas.current?.focus();
    return () => connection.releaseControls();
  }, [connection]);
  useEffect(() => {
    const release = () => {
      pressed.current.clear();
      sources.current.clear();
      connection.releaseControls();
    };
    const down = (event: KeyboardEvent) => {
      if (event.repeat || pressed.current.has(event.code)) return;
      pressed.current.add(event.code);
      if (suspended || state.outcome) return;
      if (
        (event.key === "Escape" && (menu || !interactive(event.target))) ||
        (event.code === "Space" && !interactive(event.target))
      ) {
        event.preventDefault();
        connection.releaseControls();
        setMenu((value) => !value);
        return;
      }
      if (event.key.toLowerCase() === "m" && !interactive(event.target)) {
        audio.setEnabled(!audio.enabled);
        setMuted(!audio.enabled);
        return;
      }
      const control = controlFor(event.key);
      if (
        control &&
        !menu &&
        event.target === canvas.current &&
        document.hasFocus() &&
        !document.hidden
      ) {
        event.preventDefault();
        controlInput(`key:${event.code}`, control, true);
      }
    };
    const up = (event: KeyboardEvent) => {
      pressed.current.delete(event.code);
      if (suspended) return;
      const control = controlFor(event.key);
      if (control && !interactive(event.target)) {
        controlInput(`key:${event.code}`, control, false);
        if (event.target === canvas.current) event.preventDefault();
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
  }, [connection, controlInput, menu, suspended, state.outcome, audio]);
  useEffect(() => {
    sources.current.clear();
    connection.releaseControls();
    if (!menu && !suspended && !state.outcome && state.status === "Connected")
      canvas.current?.focus();
  }, [connection, menu, suspended, state.outcome, state.status]);
  useEffect(() => {
    let handle = 0,
      lastHud = 0;
    const draw = (time: number) => {
      const view = connection.frame();
      const element = canvas.current,
        ctx = element?.getContext("2d");
      if (view && ctx && element) {
        const width = element.width,
          height = element.height;
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
        if (view.feedback.length) setFeedback(view.feedback.join(" · "));
        view.renderedCars.forEach((car, seat) => {
          const x = width / 2 + car.lateral * scale,
            cy = y(car.progress);
          const carWidth = g.carWidth * scale,
            carHeight = g.carHeight * roadScale;
          ctx.save();
          // The shared sprite is blue; rotate only the rival's paint toward red.
          if (seat !== local) ctx.filter = "hue-rotate(150deg)";
          const drawn = drawSprite(
            ctx,
            "car",
            x - carWidth / 2,
            cy - carHeight / 2,
            carWidth,
            carHeight,
          );
          ctx.restore();
          if (!drawn) {
            ctx.fillStyle = seat === local ? "#2196f3" : "#e74656";
            ctx.fillRect(x - carWidth / 2, cy - carHeight / 2, carWidth, carHeight);
          }
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
          ctx.fillText(
            seat === local ? "You" : "Rival",
            x,
            cy + (g.carHeight * roadScale) / 2 + 20,
          );
        });
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
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(""), 1800);
    return () => clearTimeout(timer);
  }, [feedback]);
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
          onClick={() => {
            connection.releaseControls();
            setMenu((value) => !value);
          }}
        >
          <Settings size={22} aria-hidden="true" />
        </button>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-heading text-red-400">
            {context.mode === 2 ? "Road Rage" : "Drag Race"}
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
            data-testid={context.mode === 2 ? "time-remaining" : "distance-remaining"}
          >
            {context.mode === 2
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
          <p
            className="pointer-events-none absolute bottom-3 left-3 z-10 rounded bg-black/75 px-2 py-1 text-xs text-sky-300"
            data-testid="nos-status"
          >
            {(frame?.cars[local].flags ?? 0) & 1 ? "NOS active" : "NOS ready"} · W / ↑
          </p>

          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col items-center gap-2 text-center text-xs">
            {feedback && (
              <p
                className="rounded bg-black/80 px-3 py-2"
                role="status"
                data-testid="object-feedback"
              >
                {feedback}
              </p>
            )}
            {frame?.awaiting && !outcome && (
              <p role="status" className="bg-black/80 p-2">
                Awaiting confirmation
              </p>
            )}
            {!((state.room?.seats[1 - local]?.flags ?? 0) & 1) && !outcome && (
              <p role="status" className="bg-black/80 p-2">
                Opponent disconnected—round continues.
              </p>
            )}
            {(frame?.stale || state.status !== "Connected") && !outcome && (
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
          <canvas
            ref={canvas}
            width={560}
            height={600}
            tabIndex={0}
            role="img"
            aria-label="Multiplayer race"
            className="block h-full w-full rounded-xl border border-neutral-600 focus:outline-2 focus:outline-red-400"
            onBlur={() => {
              pressed.current.clear();
              sources.current.clear();
              connection.releaseControls();
            }}
          />
        </div>
      </div>
      <TouchControls
        disabled={menu || suspended || Boolean(outcome) || state.status !== "Connected"}
        onControl={(control, down) => {
          if (down) canvas.current?.focus({ preventScroll: true });
          controlInput(`touch:${control}`, control, down);
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
      {outcome && <RoundResult outcome={outcome} local={local} />}
    </div>
  );
}
