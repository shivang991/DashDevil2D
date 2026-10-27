import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PairedConnection, PairedState } from "@/transport/PairedConnection";
import { RoundResult } from "@/components/RoundResult";

const button =
  "rounded-lg border border-neutral-600 px-4 py-2 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed";
const modeName = (mode: number) => (mode === 2 ? "Road Rage" : "Drag Race");

interface MultiplayerViewProps {
  mode: 1 | 2;
  onBack: () => void;
  playerName: string;
  state?: PairedState;
  error?: string;
  clock: number;
  focused: boolean;
  actions?: Pick<PairedConnection, "connect" | "command" | "leave" | "releaseControls">;
  renderRace?: (props: { suspended: boolean; onLeave: () => void }) => ReactNode;
}

/** Transport-free view shared by the live screen and isolated stories. */
export function MultiplayerView({
  mode,
  onBack,
  playerName,
  state,
  error = "",
  clock,
  focused,
  actions,
  renderRace,
}: MultiplayerViewProps) {
  const [code, setCode] = useState("");
  const [copy, setCopy] = useState("Copy");
  const [dismissedResult, setDismissedResult] = useState<number>();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const cancelLeave = useRef<HTMLButtonElement>(null);
  const room = state?.room;
  const local = state?.identity?.seat ?? 0;
  const host = room?.host === local;
  const connected = state?.status === "Connected";
  const pending = Boolean(state?.pending);
  const eligible = connected && !pending;
  const canStart = eligible && room?.seats.every((seat) => (seat.flags & 3) === 3);

  useEffect(() => {
    if (confirmLeave) cancelLeave.current?.focus();
  }, [confirmLeave]);

  // Reset transient confirmation when the server publishes a new outcome.
  const [previousOutcome, setPreviousOutcome] = useState(state?.outcome);
  if (previousOutcome !== state?.outcome) {
    setPreviousOutcome(state?.outcome);
    if (state?.outcome) setConfirmLeave(false);
  }

  const leave = () => {
    actions?.leave();
    setConfirmLeave(false);
  };
  const finalized = Boolean(state?.outcome && state.outcome.roundId === room?.roundId);
  const countdown = room?.phase === 1 && !finalized;
  const active = room?.phase === 2;
  const race =
    (active || room?.phase === 3 || (finalized && room?.phase !== 0)) &&
    (room?.mode === 1 || room?.mode === 2);
  const installed = room && state?.roundId === room.roundId && state?.startUs === room.startUs;
  const remaining = room
    ? Math.max(
        1,
        Math.min(3, Math.ceil((room.startUs - (clock + (state?.clockOffsetUs ?? 0))) / 1e6)),
      )
    : 3;
  const inRoom = Boolean(room && state?.identity && state.status !== "Disconnected");

  return (
    <main
      className={
        race
          ? "multiplayer-match bg-neutral-950 text-white"
          : "min-h-screen bg-neutral-950 text-white flex justify-center p-6"
      }
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.repeat) {
          if (confirmLeave) setConfirmLeave(false);
          else if (!inRoom) onBack();
        }
      }}
    >
      <section
        className={race ? "multiplayer-match-panel" : "w-full max-w-lg flex flex-col gap-5 py-10"}
      >
        {!race && (
          <h1 className="text-2xl font-heading">
            {inRoom
              ? race
                ? modeName(room!.mode)
                : active
                  ? "Round ready"
                  : countdown
                    ? "Starting round"
                    : "Private room"
              : modeName(mode)}
          </h1>
        )}
        {!race && <p className="text-neutral-400">{playerName}</p>}
        {!inRoom ? (
          <>
            <p>Create a private room or join a friend.</p>
            <button
              className={button}
              disabled={!state || pending}
              onClick={() => void actions?.connect(0, "", mode)}
            >
              Create Room
            </button>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (/^\d{4}$/.test(code) && !pending) void actions?.connect(1, code);
              }}
            >
              <label htmlFor="room-code">Room code</label>
              <input
                id="room-code"
                className="rounded-lg border border-neutral-600 bg-neutral-900 p-3 font-mono text-xl tracking-widest"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                autoComplete="off"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
                aria-describedby="admission-error"
              />
              <button className={button} disabled={!state || pending || !/^\d{4}$/.test(code)}>
                Join Room
              </button>
            </form>
            <p id="admission-error" role="alert">
              {error ||
                (state?.status.startsWith("Unable") ||
                state?.status === "Browser unsupported" ||
                state?.status === "Version mismatch—reload"
                  ? state.status
                  : "")}
            </p>
            <button className={button} onClick={onBack}>
              Back
            </button>
          </>
        ) : (
          <>
            {!race && (
              <>
                <div className="flex gap-4 items-center">
                  <span className="text-3xl font-mono tracking-widest" data-testid="room-code">
                    {state?.code}
                  </span>
                  <button
                    className={button}
                    onClick={() => {
                      void navigator.clipboard?.writeText(state?.code ?? "").then(
                        () => setCopy("Copied"),
                        () => setCopy("Select and copy the code"),
                      );
                    }}
                  >
                    {copy}
                  </button>
                </div>
                <p data-testid="connection-state" role="status">
                  {state?.status}
                </p>
                <p>
                  Mode: <span data-testid="selected-mode">{modeName(room!.mode)}</span>
                </p>
              </>
            )}
            {!race && (
              <ul className="flex flex-col gap-3">
                {room!.seats.map((seat, index) => (
                  <li key={index} className="rounded-lg border border-neutral-700 p-4">
                    <span>
                      {seat.session
                        ? `${seat.name}${index === local ? " (You)" : ""}`
                        : "Waiting for player"}
                    </span>
                    {seat.session > 0 && (
                      <p className="text-sm text-neutral-400">
                        {index === room!.host ? "Host · " : ""}
                        {seat.flags & 1 ? "Connected" : "Reconnecting"} ·{" "}
                        {seat.flags & 2 ? "Ready" : "Not ready"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {countdown ? (
              <div className="text-center py-8">
                <p className="text-7xl" data-testid="countdown" aria-live="polite">
                  {remaining}
                </p>
                <p>{installed ? "Get ready!" : "Preparing round…"}</p>
              </div>
            ) : race ? (
              renderRace ? (
                renderRace({
                  suspended: confirmLeave || state?.status !== "Connected",
                  onLeave: () => {
                    actions?.releaseControls();
                    setConfirmLeave(true);
                  },
                })
              ) : (
                <p>Synchronizing…</p>
              )
            ) : active ? (
              <p>{installed ? "Players synchronized." : "Synchronizing…"}</p>
            ) : (
              <>
                {host && (
                  <label className="flex flex-col gap-2">
                    Multiplayer mode
                    <select
                      className="rounded-lg bg-neutral-900 border border-neutral-600 p-3"
                      value={room!.mode}
                      disabled={!eligible}
                      onChange={(event) =>
                        actions?.command(0, Number(event.target.value), 0, "Changing mode")
                      }
                    >
                      <option value={1}>Drag Race</option>
                      <option value={2}>Road Rage</option>
                    </select>
                  </label>
                )}
                <button
                  className={button}
                  disabled={!eligible || !focused}
                  onClick={() =>
                    actions?.command(
                      1,
                      room!.mode,
                      room!.seats[local].flags & 2 ? 0 : 1,
                      "Confirming readiness",
                    )
                  }
                >
                  {room!.seats[local].flags & 2 ? "Cancel ready" : "Ready"}
                </button>
                {host && (
                  <>
                    <button
                      className={button}
                      disabled={!canStart}
                      onClick={() => actions?.command(2, room!.mode, 0, "Starting round")}
                    >
                      Start round
                    </button>
                    {!canStart && (
                      <p className="text-sm text-neutral-400">
                        Start requires two connected, initialized, focused and ready players.
                      </p>
                    )}
                  </>
                )}
                {room!.idleWarningUs > 0 &&
                  clock + (state?.clockOffsetUs ?? 0) >= room!.idleWarningUs && (
                    <p role="alert">This room will expire soon without activity.</p>
                  )}
              </>
            )}
            {room!.phase === 0 && state?.outcome && dismissedResult !== state.outcome.roundId && (
              <>
                <RoundResult outcome={state.outcome} local={local} />
                <button
                  className={button}
                  onClick={() => setDismissedResult(state.outcome!.roundId)}
                >
                  Dismiss result
                </button>
              </>
            )}
            {state?.outcome && room!.phase === 3 && (
              <button
                className={button}
                disabled={!eligible}
                onClick={() => actions?.command(5, room!.mode, 0, "Returning to lobby")}
              >
                Return to Lobby
              </button>
            )}
            {!race && (
              <button
                className={button}
                onClick={() => {
                  actions?.releaseControls();
                  if ((countdown || active) && !state?.outcome) setConfirmLeave(true);
                  else leave();
                }}
              >
                Leave
              </button>
            )}
            {import.meta.env.VITE_MULTIPLAYER_DEBUG === "true" && (
              <div className="multiplayer-debug">
                {(countdown || active) && (
                  <p className="text-sm text-neutral-400">
                    Round time: <span data-testid="round-time">{state?.timeUs ?? 0}</span>
                  </p>
                )}
                <details>
                  <summary className="cursor-pointer text-sm text-neutral-400">
                    Connection details
                  </summary>
                  <pre className="text-xs overflow-auto" data-testid="room-evidence">
                    {JSON.stringify(
                      {
                        roundId: state?.roundId,
                        startUs: state?.startUs,
                        timeUs: state?.timeUs,
                        seed: state?.seed,
                        context: state?.context,
                        objects: state?.objects,
                        contact: state?.contact,
                        cars: state?.cars,
                        identity: state?.identity,
                        roomRevision: room!.revision,
                        diagnostics: state?.diagnostics,
                        verified: state?.verified,
                        errors: state?.errors,
                        baselineBytes: state?.baselineBytes,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </div>
            )}
          </>
        )}
        {!race && state?.pending && <p role="status">{state.pending}…</p>}
        {!race && state?.notice && <p role="alert">{state.notice}</p>}
        {confirmLeave && !state?.outcome && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            className="fixed inset-0 bg-black/90 flex items-center justify-center p-6"
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                event.preventDefault();
                const buttons = event.currentTarget.querySelectorAll("button");
                const next = document.activeElement === buttons[0] ? buttons[1] : buttons[0];
                next.focus();
              }
            }}
          >
            <div className="rounded-xl border border-neutral-600 bg-neutral-950 p-6 flex flex-col gap-4">
              <h2 id="leave-title">Leave room?</h2>
              <p>
                {countdown
                  ? "Leaving cancels the countdown for both players."
                  : room!.seats[1 - local].flags & 1
                    ? "Leaving forfeits this round to the connected opponent."
                    : "Leaving abandons this round while the opponent is disconnected."}
              </p>
              <button ref={cancelLeave} className={button} onClick={() => setConfirmLeave(false)}>
                Cancel
              </button>
              <button className={button} onClick={leave}>
                Confirm leave
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
