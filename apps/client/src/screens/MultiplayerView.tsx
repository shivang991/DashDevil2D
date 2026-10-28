import {
  AdmissionOperationCreate,
  AdmissionOperationJoin,
  type Mode,
  ModeDragRace,
  ModeRoadRage,
  RoomCommandCodeReady,
  RoomCommandCodeReturnToLobby,
  RoomCommandCodeSelectMode,
  RoomCommandCodeStart,
  RoomPhaseActive,
  RoomPhaseCountdown,
  RoomPhaseEnded,
  RoomPhaseLobby,
  SeatFlagsConnected,
  SeatFlagsConnectedReady,
  SeatFlagsReady,
  SeatFlagsReturned,
  WireBooleanFalse,
  WireBooleanTrue,
} from "@dashdevil/contracts/protocol";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, Copy, LockKeyhole, X } from "lucide-react";
import defaults from "@dashdevil/contracts/configuration";
import type { MultiplayerMode, PairedConnection, PairedState } from "@/transport/PairedConnection";
import { RoundResult } from "@/components/RoundResult";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { MultiplayerDialog } from "./MultiplayerDialog";
import "./multiplayer.css";

const modeName = (mode: Mode) => (mode === ModeRoadRage ? "Road Rage" : "Drag Race");

interface MultiplayerViewProps {
  mode: MultiplayerMode;
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
  const [selectedMode, setSelectedMode] = useState(mode);
  const [code, setCode] = useState("");
  const [copy, setCopy] = useState("");
  const [joinOpen, setJoinOpen] = useState(state?.pending === "Joining room");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const cancelLeave = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const joinButton = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  const room = state?.room;
  const local = state?.identity?.seat ?? 0;
  const host = room?.host === local;
  const connected = state?.status === "Connected";
  const pending = Boolean(state?.pending);
  const eligible = connected && !pending;
  // Losing focus clears readiness on the server; remote focus is not exposed separately.
  const canStart =
    eligible &&
    focused &&
    room?.seats.every(
      (seat) => seat.session && (seat.flags & SeatFlagsConnectedReady) === SeatFlagsConnectedReady,
    );
  const ready = Boolean(room && room.seats[local].flags & SeatFlagsReady);
  const inRoom = Boolean(room && state?.identity && state.status !== "Disconnected");
  const finalized = Boolean(state?.outcome && state.outcome.roundId === room?.roundId);
  const returned = Boolean(room && room.seats[local].flags & SeatFlagsReturned);
  const resultKey =
    inRoom && finalized && room?.phase !== RoomPhaseLobby && !returned
      ? `${room!.identity.roomId}:${room!.roundId}`
      : undefined;
  const [readyResult, setReadyResult] = useState<string>();
  const [previousResultKey, setPreviousResultKey] = useState(resultKey);
  if (previousResultKey !== resultKey) {
    setPreviousResultKey(resultKey);
    setReadyResult(undefined);
  }
  const resultWait = useRef<{ key: string; receivedMs: number }>(undefined);
  const outcomeReceivedUs = state?.diagnostics.outcomeReceivedUs;
  const resultDelayMs =
    (state?.context?.presentation.roundOverDelay ?? defaults.presentation.roundOverDelay) * 1000;
  useEffect(() => {
    if (!resultKey) {
      resultWait.current = undefined;
      return;
    }
    if (resultWait.current?.key !== resultKey) {
      resultWait.current = {
        key: resultKey,
        receivedMs: outcomeReceivedUs === undefined ? performance.now() : outcomeReceivedUs / 1000,
      };
    }
    const deadlineMs = resultWait.current.receivedMs + resultDelayMs;
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      const remainingMs = deadlineMs - performance.now();
      if (remainingMs <= 0) setReadyResult(resultKey);
      // Browser timers use signed 32-bit milliseconds. Recheck the monotonic deadline.
      else timer = setTimeout(wait, Math.min(Math.ceil(remainingMs), 2_147_483_647));
    };
    timer = setTimeout(wait, 0);
    return () => clearTimeout(timer);
  }, [resultKey, outcomeReceivedUs, resultDelayMs]);
  const waitingForOther = room?.phase === RoomPhaseEnded && returned;
  const countdown = room?.phase === RoomPhaseCountdown && !finalized;
  const showCountdown = inRoom && countdown && connected;
  const active = room?.phase === RoomPhaseActive;
  const race =
    (active ||
      (room?.phase === RoomPhaseEnded && !returned) ||
      (finalized && room?.phase !== RoomPhaseLobby && !returned)) &&
    (room?.mode === ModeDragRace || room?.mode === ModeRoadRage);
  const installed = room && state?.roundId === room.roundId && state?.startUs === room.startUs;
  const remaining = room
    ? Math.max(
        1,
        Math.min(3, Math.ceil((room.startUs - (clock + (state?.clockOffsetUs ?? 0))) / 1e6)),
      )
    : 3;
  const roomError =
    error ||
    (state?.status.startsWith("Unable") ||
    state?.status === "Browser unsupported" ||
    state?.status === "Version mismatch—reload"
      ? state.status
      : "") ||
    state?.notice;
  const errorMessage = roomError && (
    <div id="room-error" className="multiplayer-error" role="alert">
      <p>{roomError}</p>
      {roomError.startsWith("Countdown cancelled") && (
        <p>A player left, lost connection, or hid the game.</p>
      )}
    </div>
  );
  const shownMode = inRoom ? room!.mode : selectedMode;
  const showJoin = !inRoom && joinOpen;

  // Admission closes the join dialog even if this room later expires remotely.
  const [previousInRoom, setPreviousInRoom] = useState(inRoom);
  if (previousInRoom !== inRoom) {
    setPreviousInRoom(inRoom);
    if (inRoom) setJoinOpen(false);
    else setConfirmLeave(false);
  }
  // Reset transient confirmation when the server publishes a new outcome.
  const [previousOutcome, setPreviousOutcome] = useState(state?.outcome);
  if (previousOutcome !== state?.outcome) {
    setPreviousOutcome(state?.outcome);
    if (state?.outcome) setConfirmLeave(false);
  }

  useEffect(() => {
    if (!copy) return;
    const timer = setTimeout(() => setCopy(""), 2500);
    return () => clearTimeout(timer);
  }, [copy]);

  const requestLeave = () => {
    actions?.releaseControls();
    setConfirmLeave(true);
  };
  const leave = () => {
    if (room) setSelectedMode(room.mode as MultiplayerMode);
    setJoinOpen(false);
    setCopy("");
    actions?.leave();
    setConfirmLeave(false);
  };
  const toggleReady = () =>
    actions?.command(
      RoomCommandCodeReady,
      room!.mode,
      ready ? WireBooleanFalse : WireBooleanTrue,
      "Confirming readiness",
    );
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(state?.code ?? "");
      setCopy("Copied");
    } catch {
      setCopy("Select and copy the code");
    }
  };

  return (
    <main
      ref={main}
      tabIndex={-1}
      className={race ? "multiplayer-match bg-neutral-950 text-white" : "multiplayer-screen"}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.repeat || event.defaultPrevented) return;
        if (showJoin || showCountdown || confirmLeave || race) return;
        if (inRoom) requestLeave();
        else if (!pending) onBack();
      }}
    >
      <section className={race ? "multiplayer-match-panel" : "multiplayer-panel"}>
        {!race && (
          <>
            <h1 className="sr-only">Multiplayer</h1>
            <header className="multiplayer-header">
              <button
                ref={backButton}
                type="button"
                className="multiplayer-back"
                aria-label={inRoom ? "Leave" : "Back"}
                disabled={!inRoom && pending}
                onClick={inRoom ? requestLeave : onBack}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <div className="multiplayer-modes" role="group" aria-label="Multiplayer mode">
                {([2, 1] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="multiplayer-mode"
                    aria-pressed={shownMode === value}
                    disabled={
                      inRoom ? !host || !eligible || room!.phase !== RoomPhaseLobby : pending
                    }
                    onClick={() => {
                      if (shownMode === value) return;
                      if (inRoom)
                        actions?.command(
                          RoomCommandCodeSelectMode,
                          value,
                          WireBooleanFalse,
                          "Changing mode",
                        );
                      else setSelectedMode(value);
                    }}
                  >
                    <span data-testid={shownMode === value ? "selected-mode" : undefined}>
                      {modeName(value)}
                    </span>
                    {inRoom && !host && shownMode === value && <LockKeyhole aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </header>
          </>
        )}
        {!inRoom ? (
          <div className="multiplayer-entry">
            <p className="multiplayer-player-name">{playerName}</p>
            <div className="multiplayer-actions">
              <Button
                className="multiplayer-action"
                disabled={!state || pending}
                onClick={() => void actions?.connect(AdmissionOperationCreate, "", selectedMode)}
              >
                {state?.pending === "Creating room" ? (
                  <>
                    <Loader size="sm" />
                    Creating…
                  </>
                ) : (
                  "Create Room"
                )}
              </Button>
              <Button
                ref={joinButton}
                className="multiplayer-action"
                disabled={!state || pending}
                onClick={() => setJoinOpen(true)}
              >
                Join Room
              </Button>
            </div>
            {pending && !showJoin && (
              <p className="multiplayer-note" role="status">
                {state?.pending}…
              </p>
            )}
          </div>
        ) : (
          <>
            {!race && (
              <>
                <p className="multiplayer-mode-hint">
                  {host
                    ? "Changing mode resets both players’ readiness."
                    : "The host chooses the mode."}
                </p>
                <div className="multiplayer-room">
                  <ul className="multiplayer-players" aria-label="Players">
                    {[room!.host, 1 - room!.host].map((index, position) => {
                      const seat = room!.seats[index];
                      return (
                        <li key={index} className="multiplayer-player">
                          {position === 1 && (
                            <span className="multiplayer-versus" aria-hidden="true">
                              vs
                            </span>
                          )}
                          <div className="multiplayer-player-info">
                            <span className="multiplayer-player-label">
                              {seat.session > 0 && Boolean(seat.flags & SeatFlagsReady) && (
                                <Check className="multiplayer-ready-check" aria-label="Ready" />
                              )}
                              <span
                                className="multiplayer-name"
                                title={seat.name || "Waiting for player"}
                              >
                                {seat.session ? (
                                  <>
                                    {seat.name}
                                    {index === local && (
                                      <span className="multiplayer-you"> (You)</span>
                                    )}
                                  </>
                                ) : (
                                  "??"
                                )}
                              </span>
                            </span>
                            <span className="multiplayer-seat-status">
                              {!seat.session
                                ? "Waiting for player"
                                : !(seat.flags & SeatFlagsConnected)
                                  ? "Reconnecting…"
                                  : index === room!.host
                                    ? "Host"
                                    : "Guest"}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="multiplayer-code-wrap">
                    <div className="multiplayer-code">
                      <span data-testid="room-code" aria-label="Room code">
                        {state?.code}
                      </span>
                      <button
                        type="button"
                        aria-label="Copy room code"
                        onClick={() => void copyCode()}
                      >
                        {copy === "Copied" ? (
                          <Check aria-hidden="true" />
                        ) : (
                          <Copy aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <span className="multiplayer-copy-feedback" role="status">
                      {copy}
                    </span>
                  </div>
                </div>
                <p
                  data-testid="connection-state"
                  role="status"
                  className={connected ? "sr-only" : "multiplayer-note"}
                >
                  {state?.status}
                </p>
              </>
            )}
            {countdown ? null : race ? (
              renderRace ? (
                renderRace({
                  suspended: confirmLeave || state?.status !== "Connected",
                  onLeave: requestLeave,
                })
              ) : (
                <p>Synchronizing…</p>
              )
            ) : active ? (
              <p>{installed ? "Players synchronized." : "Synchronizing…"}</p>
            ) : waitingForOther ? (
              <p className="multiplayer-note" role="status">
                Waiting for other player to return…
              </p>
            ) : (
              <div className="multiplayer-ready-actions">
                <Button
                  className={`multiplayer-action ${host && canStart ? "multiplayer-start" : ""}`}
                  disabled={!eligible || !focused || (ready && (!host || !canStart))}
                  onClick={
                    host && canStart
                      ? () =>
                          actions?.command(
                            RoomCommandCodeStart,
                            room!.mode,
                            WireBooleanFalse,
                            "Starting round",
                          )
                      : toggleReady
                  }
                >
                  {host && canStart
                    ? "Start round"
                    : ready
                      ? host
                        ? "Waiting for player…"
                        : "Ready"
                      : "Ready"}
                </Button>
                {ready && (
                  <button
                    className="multiplayer-text-button"
                    disabled={!eligible}
                    onClick={toggleReady}
                  >
                    Cancel ready
                  </button>
                )}
                <p className="multiplayer-note">
                  {!focused
                    ? "Return to the game to ready up."
                    : !host && ready
                      ? "Waiting for the host to start."
                      : host && canStart
                        ? "Both players ready. Start your engines."
                        : "Both players must be connected and ready to start."}
                </p>
                {room!.idleWarningUs > 0 &&
                  clock + (state?.clockOffsetUs ?? 0) >= room!.idleWarningUs && (
                    <p role="alert">This room will expire soon without activity.</p>
                  )}
              </div>
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
        {!race && inRoom && state?.pending && (
          <p className="multiplayer-note" role="status">
            {state.pending}…
          </p>
        )}
        {!race && !showJoin && !pending && errorMessage}
      </section>
      <MultiplayerDialog
        open={Boolean(resultKey && readyResult === resultKey)}
        title="Round Over"
        description="The multiplayer round has ended."
        className="round-result-dialog"
        returnFocus={main}
      >
        {state?.outcome && <RoundResult outcome={state.outcome} local={local} />}
        <Button
          className="round-result-return"
          disabled={!eligible || room?.phase !== RoomPhaseEnded}
          onClick={() =>
            actions?.command(
              RoomCommandCodeReturnToLobby,
              room!.mode,
              WireBooleanFalse,
              "Returning to lobby",
            )
          }
        >
          Return to Lobby
        </Button>
      </MultiplayerDialog>
      <MultiplayerDialog
        open={showJoin}
        title={pending ? "Joining" : "Join room"}
        description={
          pending
            ? "Connecting to your friend’s room."
            : "Enter your friend’s four-digit room code."
        }
        onDismiss={pending ? undefined : () => setJoinOpen(false)}
        dismissOutside={!pending}
        returnFocus={joinButton}
      >
        {pending ? (
          <div className="multiplayer-joining" role="status">
            <Loader />
            <span className="sr-only">Joining room…</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="multiplayer-dialog-close"
              aria-label="Close join dialog"
              onClick={() => setJoinOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
            <form
              className="multiplayer-join-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (/^\d{4}$/.test(code) && !pending && state)
                  void actions?.connect(AdmissionOperationJoin, code);
              }}
            >
              <label htmlFor="room-code">Room code</label>
              <input
                id="room-code"
                className="multiplayer-code-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                autoComplete="off"
                autoFocus
                placeholder="Enter code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
                aria-invalid={Boolean(roomError)}
                aria-describedby={roomError ? "room-error" : undefined}
              />
              {errorMessage}
              <Button className="multiplayer-action" disabled={!state || !/^\d{4}$/.test(code)}>
                Join Room
              </Button>
            </form>
          </>
        )}
      </MultiplayerDialog>
      <MultiplayerDialog
        open={Boolean(showCountdown && !confirmLeave)}
        title="Starting"
        description="The race starts after the countdown."
        onDismiss={requestLeave}
        returnFocus={main}
      >
        <p
          className="multiplayer-countdown"
          data-testid="countdown"
          aria-live="polite"
          aria-atomic="true"
        >
          {remaining}
        </p>
        <p className="multiplayer-note">{installed ? "Get ready!" : "Preparing round…"}</p>
        <button className="multiplayer-text-button" onClick={requestLeave}>
          Leave
        </button>
      </MultiplayerDialog>
      <MultiplayerDialog
        open={confirmLeave && inRoom && (!race || !state?.outcome)}
        title="Leave room?"
        description="Confirm before leaving your multiplayer room."
        onDismiss={() => setConfirmLeave(false)}
        initialFocus={cancelLeave}
        returnFocus={main}
      >
        <p className="multiplayer-leave-description">
          {countdown
            ? "Leaving cancels the countdown for both players."
            : !race
              ? "You’ll return to the multiplayer screen."
              : room!.seats[1 - local].flags & SeatFlagsConnected
                ? "Leaving forfeits this round to the connected opponent."
                : "Leaving abandons this round while the opponent is disconnected."}
        </p>
        {!race && host && Boolean(room?.seats[1 - local].session) && (
          <p className="multiplayer-note">{room!.seats[1 - local].name} becomes the host.</p>
        )}
        <Button
          ref={cancelLeave}
          className="multiplayer-action"
          onClick={() => setConfirmLeave(false)}
        >
          Cancel
        </Button>
        <button className="multiplayer-text-button" onClick={leave}>
          Confirm leave
        </button>
      </MultiplayerDialog>
    </main>
  );
}
