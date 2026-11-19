import { useRef, type ReactNode, type RefObject } from "react";
import { Dialog } from "radix-ui";

/** Inline Radix content keeps story canvases isolated while trapping modal focus. */
export function MultiplayerDialog({
  open,
  title,
  description,
  onDismiss,
  dismissOutside = false,
  modal = true,
  initialFocus,
  returnFocus,
  children,
  variant = "default",
}: {
  open: boolean;
  title: string;
  description: string;
  onDismiss?: () => void;
  dismissOutside?: boolean;
  modal?: boolean;
  initialFocus?: RefObject<HTMLButtonElement | null>;
  returnFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
  variant?: "default" | "result";
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root modal={modal} open={open} onOpenChange={(next) => !next && onDismiss?.()}>
      <Dialog.Overlay
        className={`fixed inset-0 z-50 ${variant === "result" ? "bg-black/68" : "bg-black/80"}`}
      />
      <Dialog.Content
        className={`stepped-panel fixed z-51 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[calc(100dvh_-_40px)] overflow-y-auto flex flex-col border text-neutral-50 ${variant === "result" ? "result-panel w-[min(400px,calc(100vw_-_28px))] gap-0 p-[clamp(28px,6vw,44px)] border-[#bcbab5] rounded-[18px] bg-[#101010] text-center" : "w-[min(440px,calc(100vw_-_40px))] gap-5 p-9 border-neutral-600 rounded-[20px] bg-neutral-950 [@media(max-width:520px)]:px-6 [@media(max-width:520px)]:pt-8 [@media(max-width:520px)]:pb-6"}`}
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
        <Dialog.Title
          className={
            variant === "result"
              ? "p-0 text-center text-[#e2dfda] text-[clamp(38px,8vw,54px)] leading-none tracking-[-0.045em]"
              : "px-5 text-center text-[32px] leading-[1.2]"
          }
        >
          {title}
        </Dialog.Title>
        <Dialog.Description className="sr-only">{description}</Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Root>
  );
}
