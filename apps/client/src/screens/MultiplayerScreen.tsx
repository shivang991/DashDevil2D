import {
  AdmissionOperationCreate,
  AdmissionOperationJoin,
  AdmissionOperationResume,
  RoomPhaseCountdown,
} from "@dashdevil/contracts/protocol";

import { useBlocker, useNavigate, useLocation } from "react-router";
import { NavigationConfirmation } from "./NavigationConfirmation";
import { multiplayerPath } from "@/lib/uiUtils";
import { GameAudio } from "@/lib/gameAudio";
import { useEffect, useRef, useState } from "react";
import {
  PairedConnection,
  type PairedState,
  type MultiplayerMode,
} from "@/game/multiplayer/PairedConnection";
import { MultiplayerView } from "./MultiplayerView";
import { RaceView } from "@/components/RaceView";
import { chatAPI } from "@/transport/chat";
import { connectionOptions } from "@/transport/account";

export function MultiplayerScreen({
  mode,
  onBack,
  playerName,
  playerAvatar,
}: {
  mode: MultiplayerMode;
  onBack: () => void;
  playerName: string;
  playerAvatar?: string;
}) {
  const location = useLocation();
  const intent = location.state as { challenge?: number; challengePeer?: number } | null;
  const invitationIntent = {
    challenge: intent?.challenge,
    peer: intent?.challengePeer,
    key: `challenge:${location.key}`,
  };
  const inviteStarted = useRef<string | undefined>(undefined);
  const admissionStarted = useRef<string | undefined>(undefined);
  const connection = useRef<PairedConnection | undefined>(undefined);
  const [client, setClient] = useState<PairedConnection>();
  const [state, setState] = useState<PairedState>();
  const [error, setError] = useState("");
  const [clock, setClock] = useState(0);
  const navigate = useNavigate();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation, historyAction }) =>
      historyAction !== "REPLACE" &&
      currentLocation.pathname !== nextLocation.pathname &&
      Boolean(connection.current?.state.room || connection.current?.state.pending),
  );
  useEffect(() => {
    if (blocker.state === "blocked") connection.current?.releaseControls();
  }, [blocker.state]);
  useEffect(() => {
    if (state?.room && state.room.mode !== mode) {
      void navigate(multiplayerPath(state.room.mode as MultiplayerMode), { replace: true });
    }
  }, [state?.room, mode, navigate]);
  useEffect(() => {
    let disposed = false;
    const focus = () => connection.current?.focus(document.hasFocus(), document.hidden);
    const load = async () => {
      try {
        const options = await connectionOptions();
        if (disposed) return;
        const client = new PairedConnection(options, (next) => {
          setState(next);
        });
        connection.current = client;
        setClient(client);
        setState({ ...client.state });
        focus();
      } catch (failure) {
        if (!disposed) setError(String(failure instanceof Error ? failure.message : failure));
      }
    };
    void load();
    window.addEventListener("focus", focus);
    window.addEventListener("blur", focus);
    document.addEventListener("visibilitychange", focus);
    const timer = setInterval(() => setClock(performance.now() * 1000), 50);
    return () => {
      disposed = true;
      clearInterval(timer);
      connection.current?.dispose();
      connection.current = undefined;
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);

  useEffect(() => {
    if (!client || admissionStarted.current === invitationIntent.key) return;
    admissionStarted.current = invitationIntent.key;
    if (invitationIntent.challenge)
      void client.connect(AdmissionOperationJoin, "", mode, invitationIntent.challenge);
    else if (invitationIntent.peer && !client.state.room)
      void client.connect(AdmissionOperationCreate, "", mode);
    else if (client.hasCredential && !client.state.room)
      void client.connect(AdmissionOperationResume);
  }, [client, invitationIntent.challenge, invitationIntent.peer, invitationIntent.key, mode]);

  useEffect(() => {
    if (
      !invitationIntent.peer ||
      inviteStarted.current === invitationIntent.key ||
      state?.status !== "Connected" ||
      !state.identity
    )
      return;
    inviteStarted.current = invitationIntent.key;
    void chatAPI
      .invite(invitationIntent.peer, state.identity.roomId, invitationIntent.key)
      .catch((failure) => {
        setError(
          failure instanceof Error
            ? failure.message
            : "Challenge failed. Retry from the conversation",
        );
      });
  }, [invitationIntent.peer, invitationIntent.key, state]);

  // Countdown cues precede RaceView playback at the synchronized race start.
  const countdownPlayer = useRef<GameAudio | undefined>(undefined);
  const previousCount = useRef<string | undefined>(undefined);
  useEffect(() => {
    const player = new GameAudio();
    countdownPlayer.current = player;
    player.unlock();
    return () => {
      player.dispose();
      countdownPlayer.current = undefined;
    };
  }, []);
  useEffect(() => {
    if (state?.room?.phase !== RoomPhaseCountdown || state.status !== "Connected") {
      previousCount.current = undefined;
      return;
    }
    const count = Math.max(
      1,
      Math.min(3, Math.ceil((state.room.startUs - (clock + state.clockOffsetUs)) / 1e6)),
    );
    const key = `${state.room.roundId}:${count}`;
    if (previousCount.current !== key) {
      previousCount.current = key;
      countdownPlayer.current?.playEffect("countdown");
    }
  }, [state, clock]);

  return (
    <>
      <MultiplayerView
        mode={mode}
        navigationBlocked={blocker.state === "blocked"}
        onBack={onBack}
        onModeChange={(value) => void navigate(multiplayerPath(value), { flushSync: true })}
        playerName={playerName}
        playerAvatar={playerAvatar}
        state={state}
        error={error}
        clock={clock}
        actions={client}
        focused={!document.hidden && document.hasFocus()}
        renderRace={
          client && state?.context
            ? (props) => (
                <RaceView key={state.roundId} connection={client} state={state} {...props} />
              )
            : undefined
        }
      />
      <NavigationConfirmation
        blocker={blocker}
        multiplayer
        onLeave={() => connection.current?.leave()}
      />
    </>
  );
}
