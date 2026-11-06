import { useRef, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { MultiplayerDialog } from "./MultiplayerDialog";

export function LeaveConfirmation({
  open,
  multiplayer,
  description,
  children,
  onCancel,
  onConfirm,
  returnFocus,
}: {
  open: boolean;
  multiplayer: boolean;
  description: string;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <MultiplayerDialog
      open={open}
      title={multiplayer ? "Leave room?" : "End run?"}
      description={description}
      initialFocus={cancel}
      returnFocus={returnFocus}
      onDismiss={onCancel}
    >
      {children}
      <Button ref={cancel} variant="multiplayer" size="multiplayer" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="text" onClick={onConfirm}>
        {multiplayer ? "Confirm leave" : "End run"}
      </Button>
    </MultiplayerDialog>
  );
}
