import { useRef, type ReactNode, type RefObject } from "react";
import { Dialog } from "radix-ui";

/** Inline Radix content keeps story canvases isolated while trapping modal focus. */
export function MultiplayerDialog({
  open,
  title,
  description,
  onDismiss,
  dismissOutside = false,
  initialFocus,
  returnFocus,
  children,
  className,
}: {
  open: boolean;
  title: string;
  description: string;
  onDismiss?: () => void;
  dismissOutside?: boolean;
  initialFocus?: RefObject<HTMLButtonElement | null>;
  returnFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onDismiss?.()}>
      <Dialog.Overlay
        className={`multiplayer-dialog-scrim${className ? ` ${className}-scrim` : ""}`}
      />
      <Dialog.Content
        className={`multiplayer-dialog${className ? ` ${className}` : ""}`}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          if (!event.repeat) onDismiss?.();
        }}
        onPointerDownOutside={(event) => {
          if (!dismissOutside) event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          previousFocus.current = document.activeElement as HTMLElement | null;
          if (initialFocus?.current) {
            event.preventDefault();
            initialFocus.current.focus();
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const previous = previousFocus.current;
          const canRestore = previous?.isConnected && previous !== document.body;
          (canRestore ? previous : returnFocus.current)?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.stopPropagation();
        }}
      >
        <Dialog.Title className="multiplayer-dialog-title">{title}</Dialog.Title>
        <Dialog.Description className="sr-only">{description}</Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Root>
  );
}
