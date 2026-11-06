import { Button } from "./ui/button";
import { InlineFeedback } from "./ui/inline-feedback";
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
    <div className="[&_strong]:block [&_small]:block [&_small]:font-chat [&_small]:leading-[1.45] [&_small]:text-neutral-400 [&_p]:font-chat [&_p]:leading-[1.45]">
      <strong>Room challenge</strong>
      <InlineFeedback tone="info">{note}</InlineFeedback>
      {status === "Pending" && (
        <small>Expires {new Date(invitation.expiresAt).toLocaleTimeString()}</small>
      )}
      {incoming && status === "Pending" && (
        <Button
          variant="chat"
          disabled={playing || inRoom || pending || accepting}
          onClick={(event) => {
            event.currentTarget.disabled = true;
            setAccepting(true);
            onAccept();
          }}
        >
          {accepting || pending ? "Accepting…" : "Accept challenge"}
        </Button>
      )}
    </div>
  );
}
