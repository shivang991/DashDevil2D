import type { ComponentProps, ReactNode } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";

type DialogContentProps = Pick<
  ComponentProps<typeof Dialog.Content>,
  "onOpenAutoFocus" | "onCloseAutoFocus" | "onEscapeKeyDown" | "onInteractOutside"
> & {
  title: string;
  description: string;
  closeDisabled?: boolean;
  children: ReactNode;
};

export function DialogContent({
  title,
  description,
  closeDisabled,
  children,
  ...hooks
}: DialogContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
      <Dialog.Content
        {...hooks}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-hidden rounded-xl border border-neutral-600 bg-neutral-950 p-6 text-white"
      >
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto [&>*]:shrink-0">
          <Dialog.Title className="text-center text-xl">{title}</Dialog.Title>
          <Dialog.Description className="text-center text-sm text-neutral-400">
            {description}
          </Dialog.Description>
          {children}
        </div>
        <Dialog.Close asChild>
          <Button
            type="button"
            variant="multiplayer"
            disabled={closeDisabled}
            className="border-transparent bg-transparent text-neutral-400"
          >
            Close
          </Button>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
