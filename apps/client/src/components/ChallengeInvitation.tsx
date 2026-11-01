import { useEffect, useState } from "react";
import type { ChatChallenge } from "@/transport/chat";

export function ChallengeInvitation({
  invitation,
  incoming,
  playing,
  inRoom,
  onAccept,
  pending = false,
}: {
  invitation: ChatChallenge;
  incoming: boolean;
  playing: boolean;
  inRoom: boolean;
  onAccept: () => void;
  pending?: boolean;
}) {
  const [accepting, setAccepting] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const status =
    invitation.status === "Pending" && invitation.expiresAt <= now ? "Expired" : invitation.status;
  const note =
    status !== "Pending"
      ? status
      : playing
        ? "Finish your game before accepting"
        : inRoom && incoming
          ? "Leave your current room before accepting"
          : incoming
            ? "Join the lobby, then choose readiness"
            : "Waiting for acceptance";
  return (
    <div className="chat-challenge">
      <strong>Room challenge</strong>
      <p role="status">{note}</p>
      {status === "Pending" && (
        <small>Expires {new Date(invitation.expiresAt).toLocaleTimeString()}</small>
      )}
      {incoming && status === "Pending" && (
        <button
          disabled={playing || inRoom || pending || accepting}
          onClick={(event) => {
            event.currentTarget.disabled = true;
            setAccepting(true);
            onAccept();
          }}
        >
          {accepting || pending ? "Accepting…" : "Accept challenge"}
        </button>
      )}
    </div>
  );
}
