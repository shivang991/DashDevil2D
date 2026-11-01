import { multiplayerTextButton } from "@/components/ui/styles";
import { useRef } from "react";
import type { Blocker } from "react-router";
import { MultiplayerDialog } from "./MultiplayerDialog";
import { Button } from "@/components/ui/button";

export function NavigationConfirmation({
  blocker,
  multiplayer = false,
  onLeave,
}: {
  blocker: Blocker;
  multiplayer?: boolean;
  onLeave?: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const focus = useRef<HTMLElement>(null);
  return (
    <MultiplayerDialog
      open={blocker.state === "blocked"}
      title={multiplayer ? "Leave room?" : "End run?"}
      description={
        multiplayer
          ? "Leaving ends your room session and may forfeit the round."
          : "Leaving ends this Long Drive run."
      }
      onDismiss={() => blocker.state === "blocked" && blocker.reset()}
      initialFocus={cancel}
      returnFocus={focus}
    >
      <Button ref={cancel} onClick={() => blocker.state === "blocked" && blocker.reset()}>
        Cancel
      </Button>
      <button
        className={multiplayerTextButton}
        onClick={() => {
          if (blocker.state !== "blocked") return;
          onLeave?.();
          blocker.proceed();
        }}
      >
        {multiplayer ? "Confirm leave" : "End run"}
      </button>
    </MultiplayerDialog>
  );
}
