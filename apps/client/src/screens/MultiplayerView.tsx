import { multiplayerNote, multiplayerTextButton } from "@/components/ui/styles";
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

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, Copy, LockKeyhole, TriangleAlert, X } from "lucide-react";
import defaults from "@dashdevil/contracts/configuration";
import type {
  MultiplayerMode,
  PairedConnection,
  PairedState,
} from "@/game/multiplayer/PairedConnection";
import { ChatVisibility } from "@/components/Chat";
import { Avatar } from "@/components/Avatar";
import { RoundResult } from "@/components/RoundResult";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { MultiplayerDialog } from "./MultiplayerDialog";

const modeName = (mode: Mode) => (mode === ModeRoadRage ? "Road Rage" : "Drag Race");

interface MultiplayerViewProps {
  mode: MultiplayerMode;
  onBack: () => void;
  onModeChange?: (mode: MultiplayerMode) => void;
  navigationBlocked?: boolean;
  playerName: string;
  playerAvatar?: string;
  state?: PairedState;
  error?: string;
  clock: number;
  focused: boolean;
  actions?: Pick<PairedConnection, "connect" | "command" | "leave" | "releaseControls">;
  renderRace?: (props: {
    suspended: boolean;
    countdown?: number;
    onLeave: () => void;
  }) => ReactNode;
}

/** Transport-free view shared by the live screen and isolated stories. */
export function MultiplayerView({
  mode,
  onBack,
  onModeChange,
  navigationBlocked = false,
  playerName,
  playerAvatar,
  state,
  error = "",
  clock,
  focused,
  actions,
  renderRace,
}: MultiplayerViewProps) {
  const [selectedMode, setSelectedMode] = useState(mode);
  const [previousMode, setPreviousMode] = useState(mode);
  if (previousMode !== mode) {
    setPreviousMode(mode);
    setSelectedMode(mode);
  }
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
  const active = room?.phase === RoomPhaseActive;
  const race =
    (countdown ||
      active ||
      (room?.phase === RoomPhaseEnded && !returned) ||
      (finalized && room?.phase !== RoomPhaseLobby && !returned)) &&
    (room?.mode === ModeDragRace || room?.mode === ModeRoadRage);
  const installed = room && state?.roundId === room.roundId && state?.startUs === room.startUs;
  const previewReady = countdown && installed && Boolean(renderRace);
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
  const [visibleError, setVisibleError] = useState("");
  const errorCount = state?.errors.length ?? 0;
  const presentError = useEffectEvent((message: string) => {
    setJoinOpen(false);
    setVisibleError(message);
  });
  const joinFailure = useEffectEvent(() => joinOpen && !inRoom);
  const clearError = useEffectEvent(() => setVisibleError(""));
  useEffect(() => {
    if (!roomError || pending) {
      clearError();
      return;
    }
    const delay = joinFailure() ? 500 : 0;
    const show = delay ? setTimeout(() => presentError(roomError), delay) : undefined;
    if (!delay) presentError(roomError);
    const hide = setTimeout(() => setVisibleError(""), delay + 2000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [roomError, pending, errorCount]);
  const errorMessage = visibleError && (
    <div
      id="room-error"
      role="alert"
      className="flex items-start justify-center gap-2 text-[12px] leading-[1.7] text-[#f87171] wrap-anywhere"
    >
      <TriangleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-left [&_p+p]:mt-2">
        <p>{visibleError}</p>
        {visibleError.startsWith("Countdown cancelled") && (
          <p>A player left, lost connection, or hid the game.</p>
        )}
      </div>
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
      className={
        race
          ? "flex h-dvh items-center justify-center overflow-hidden px-3 py-[clamp(8px,2vh,24px)] bg-neutral-950 text-white"
          : "grid min-h-dvh place-items-center bg-neutral-950 px-5 py-8 text-neutral-50 [@media(max-width:520px)]:px-4 [@media(max-width:520px)]:py-6 [&_button:enabled]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-[5px] [&_button:focus-visible]:outline-neutral-50"
      }
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.repeat || event.defaultPrevented) return;
        if (showJoin || confirmLeave) return;
        if (countdown) {
          event.preventDefault();
          requestLeave();
          return;
        }
        if (race) return;
        if (inRoom) requestLeave();
        else if (!pending) onBack();
      }}
    >
      <ChatVisibility
        visible={!race || Boolean(resultKey && readyResult === resultKey)}
        playing={Boolean(countdown || active)}
        pending={pending}
        admissionFailure={
          !pending && roomError ? `${state?.errors.length ?? 0}:${roomError}` : undefined
        }
        roomID={inRoom ? room?.identity.roomId : undefined}
      />
      <section
        className={
          race
            ? "flex h-[min(100%,calc(min(560px,100vw_-_48px)*15/14_+_150px))] min-h-0 w-full max-w-[608px] flex-col gap-2 rounded-[24px] border border-neutral-700 p-[clamp(10px,2vw,22px)] has-[.multiplayer-debug]:h-[min(100%,calc(min(560px,100vw_-_48px)*15/14_+_270px))]"
            : "flex w-[min(100%,640px)] flex-col gap-6"
        }
      >
        {!race && (
          <>
            <h1 className="sr-only">Multiplayer</h1>
            {!inRoom && (
              <div className="flex items-center justify-center gap-2 text-[12px] text-neutral-400 wrap-anywhere">
                <Avatar username={playerName} avatar={playerAvatar} className="size-7" />
                <span>{playerName}</span>
              </div>
            )}
            <header className="flex items-center gap-5 [@media(max-width:520px)]:gap-1">
              <button
                ref={backButton}
                type="button"
                className="grid h-14 flex-[0_0_44px] place-items-center rounded-[12px] text-neutral-400 enabled:hover:bg-neutral-800 enabled:hover:text-neutral-50 [@media(max-width:520px)]:basis-9 [&_svg]:size-8 [&_svg]:stroke-[1.5]"
                aria-label={inRoom ? "Leave" : "Back"}
                disabled={!inRoom && pending}
                onClick={inRoom ? requestLeave : onBack}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <div
                className="grid min-w-0 flex-1 grid-cols-2 items-center gap-2"
                role="group"
                aria-label="Multiplayer mode"
              >
                {([2, 1] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="relative min-h-[154px] scale-[0.86] rounded-[20px] border border-neutral-700 bg-neutral-900 px-3 py-5 font-heading text-[clamp(23px,4vw,32px)] leading-[1.2] font-light text-neutral-50 opacity-75 aria-pressed:scale-100 aria-pressed:border-neutral-400 aria-pressed:opacity-100 [@media(max-width:520px)]:min-h-[120px] [@media(max-width:520px)]:rounded-[16px] [@media(max-width:520px)]:px-2 [@media(max-width:520px)]:py-4 [@media(max-width:520px)]:text-[23px] [&_svg]:absolute [&_svg]:bottom-3 [&_svg]:left-[calc(50%_-_6px)] [&_svg]:size-3 [&_svg]:text-neutral-400"
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
                      else {
                        setSelectedMode(value);
                        onModeChange?.(value);
                      }
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
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-4">
              <Button
                variant="multiplayer"
                size="multiplayer"
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
                variant="multiplayer"
                size="multiplayer"
                disabled={!state || pending}
                onClick={() => setJoinOpen(true)}
              >
                Join Room
              </Button>
            </div>
          </div>
        ) : (
          <>
            {!race && (
              <>
                <div className="flex items-center justify-between gap-6 pt-[30px] pb-3 max-sm:flex-col max-sm:items-stretch max-sm:gap-7 max-sm:pt-3">
                  <ul
                    className="flex min-w-0 flex-1 flex-col items-stretch gap-[18px] sm:flex-row sm:items-center"
                    aria-label="Players"
                  >
                    {[room!.host, 1 - room!.host].map((index, position) => {
                      const seat = room!.seats[index];
                      return (
                        <li key={index} className="flex min-w-0 flex-1 items-center gap-[18px]">
                          {position === 1 && (
                            <span
                              className="hidden font-heading text-[20px] text-neutral-400 sm:block"
                              aria-hidden="true"
                            >
                              vs
                            </span>
                          )}
                          {seat.session > 0 && <Avatar username={seat.name} avatar={seat.avatar} />}
                          <div className="flex min-w-0 flex-col gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 text-[14px] leading-[1.7] [@media(max-width:520px)]:text-[12px]">
                              {seat.session > 0 && Boolean(seat.flags & SeatFlagsReady) && (
                                <Check className="size-4 shrink-0" aria-label="Ready" />
                              )}
                              <span
                                className="min-w-0 wrap-anywhere"
                                title={seat.name || "Waiting for player"}
                              >
                                {seat.session ? (
                                  <>
                                    {seat.name}
                                    {index === local && (
                                      <span className="text-[10px] whitespace-nowrap text-neutral-400">
                                        {" "}
                                        (You)
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  "??"
                                )}
                              </span>
                            </span>
                            <span className="text-[10px] leading-[1.6] text-neutral-400">
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
                  <div className="relative shrink-0 max-sm:self-center">
                    <div className="flex items-center rounded-[12px] border border-neutral-700 pl-4 [&>span]:font-heading [&>span]:text-[32px] [&>span]:tracking-[2px] [&>span]:select-all [&_button]:grid [&_button]:min-h-12 [&_button]:w-11 [&_button]:place-items-center [&_button]:rounded-[10px] [&_button:hover]:bg-neutral-800 [&_button:hover]:text-neutral-50 [&_svg]:size-4">
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
                    <span
                      className="absolute top-[calc(100%_+_8px)] right-0 min-w-full max-w-[200px] text-center text-[10px] text-neutral-400"
                      role="status"
                    >
                      {copy}
                    </span>
                  </div>
                </div>
              </>
            )}
            {race ? (
              renderRace && (!countdown || previewReady) ? (
                renderRace({
                  suspended:
                    countdown || confirmLeave || navigationBlocked || state?.status !== "Connected",
                  countdown: countdown ? remaining : undefined,
                  onLeave: requestLeave,
                })
              ) : (
                <div className="grid flex-1 place-content-center gap-3 text-center" role="status">
                  {countdown && connected && (
                    <p
                      className="py-4 text-center font-heading text-[144px] leading-none font-light"
                      data-testid="countdown"
                    >
                      {remaining}
                    </p>
                  )}
                  <p data-testid="connection-state">
                    {!connected ? state?.status : countdown ? "Preparing round…" : "Synchronizing…"}
                  </p>
                  <button className={multiplayerTextButton} onClick={requestLeave}>
                    Leave
                  </button>
                </div>
              )
            ) : active ? (
              <p>{installed ? "Players synchronized." : "Synchronizing…"}</p>
            ) : waitingForOther ? (
              <p className={multiplayerNote} role="status">
                Waiting for other player to return…
              </p>
            ) : (
              <div className="mt-7 flex flex-col gap-3.5 [@media(max-width:520px)]:mt-3">
                <Button
                  variant="multiplayer"
                  size="multiplayer"
                  className={
                    host && canStart
                      ? "border-neutral-50 animate-[multiplayer-start-pulse_2.4s_ease-in-out_infinite] motion-reduce:animate-none"
                      : undefined
                  }
                  disabled={!eligible || !focused || (ready && host && !canStart)}
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
                        : "Waiting for host."
                      : "Ready"}
                </Button>
                {ready && host && (
                  <button
                    className={multiplayerTextButton}
                    disabled={!eligible}
                    onClick={toggleReady}
                  >
                    Cancel ready
                  </button>
                )}
              </div>
            )}
            {import.meta.env.VITE_MULTIPLAYER_DEBUG === "true" && (
              <div className="multiplayer-debug max-h-[min(120px,20dvh)] shrink-0 overflow-auto border-t border-dashed border-neutral-600 pt-2">
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
        {!race && (
          <div className="relative h-[144px] shrink-0" aria-label="Room messages">
            <div className="absolute inset-0 overflow-y-auto">
              {!showJoin && !pending && errorMessage}
            </div>
          </div>
        )}
      </section>
      <MultiplayerDialog
        open={Boolean(resultKey && readyResult === resultKey)}
        title="Round Over"
        modal={false}
        description="The multiplayer round has ended."
        variant="result"
        returnFocus={main}
      >
        {state?.outcome && (
          <RoundResult outcome={state.outcome} local={local} identities={state.room?.racers} />
        )}
        <Button
          className="mt-[58px] min-h-[58px] w-full rounded-[10px] border border-[#b9554e] bg-[#913a34] text-[16px] leading-[calc(20/14)] text-[#fff8f4] enabled:hover:bg-[#a7443c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fff8f4]"
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
          <div className="grid min-h-[152px] place-items-center" role="status">
            <Loader />
            <span className="sr-only">Joining room…</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="absolute top-2 right-2 grid size-11 place-items-center rounded-[12px] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50 [&_svg]:size-[18px]"
              aria-label="Close join dialog"
              onClick={() => setJoinOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
            <form
              className="flex flex-col gap-4 [&_label]:text-[11px] [&_label]:text-neutral-400"
              onSubmit={(event) => {
                event.preventDefault();
                if (/^\d{4}$/.test(code) && !pending && state)
                  void actions?.connect(AdmissionOperationJoin, code);
              }}
            >
              <label className="sr-only" htmlFor="room-code">
                Room code
              </label>
              <input
                id="room-code"
                className="min-h-[70px] w-full rounded-[10px] border border-neutral-600 bg-neutral-900 p-3 text-center text-[24px] tracking-[8px] text-neutral-50 placeholder:text-[16px] placeholder:tracking-normal placeholder:text-neutral-400 aria-invalid:border-[#f87171] focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-neutral-50"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                autoComplete="off"
                autoFocus
                placeholder="Enter code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
              />
              <Button
                variant="multiplayer"
                size="multiplayer"
                disabled={!state || !/^\d{4}$/.test(code)}
              >
                Join Room
              </Button>
            </form>
          </>
        )}
      </MultiplayerDialog>
      <MultiplayerDialog
        open={confirmLeave && inRoom && (!race || !state?.outcome)}
        title="Leave room?"
        description="Confirm before leaving your multiplayer room."
        onDismiss={() => setConfirmLeave(false)}
        initialFocus={cancelLeave}
        returnFocus={main}
      >
        <p className="text-center text-[12px] leading-[1.8] text-neutral-300">
          {countdown
            ? "Leaving cancels the countdown for both players."
            : !race
              ? "You’ll return to the multiplayer screen."
              : room!.seats[1 - local].flags & SeatFlagsConnected
                ? "Leaving forfeits this round to the connected opponent."
                : "Leaving abandons this round while the opponent is disconnected."}
        </p>
        {!race && host && Boolean(room?.seats[1 - local].session) && (
          <p className={multiplayerNote}>{room!.seats[1 - local].name} becomes the host.</p>
        )}
        <Button
          ref={cancelLeave}
          variant="multiplayer"
          size="multiplayer"
          onClick={() => setConfirmLeave(false)}
        >
          Cancel
        </Button>
        <button className={multiplayerTextButton} onClick={leave}>
          Confirm leave
        </button>
      </MultiplayerDialog>
    </main>
  );
}
