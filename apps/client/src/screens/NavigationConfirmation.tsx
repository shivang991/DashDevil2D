import { useRef } from "react";
import type { Blocker } from "react-router";
import { LeaveConfirmation } from "./LeaveConfirmation";

export function NavigationConfirmation({
  blocker,
  multiplayer = false,
  onLeave,
}: {
  blocker: Blocker;
  multiplayer?: boolean;
  onLeave?: () => void;
}) {
  const focus = useRef<HTMLElement>(null);
  return (
    <LeaveConfirmation
      open={blocker.state === "blocked"}
      multiplayer={multiplayer}
      description={
        multiplayer
          ? "Leaving ends your room session and may forfeit the round."
          : "Leaving ends this Long Drive run."
      }
      onCancel={() => blocker.state === "blocked" && blocker.reset()}
      returnFocus={focus}
      onConfirm={() => {
        if (blocker.state !== "blocked") return;
        onLeave?.();
        blocker.proceed();
      }}
    />
  );
}
