import type { ComponentProps, ReactNode } from "react";
import {
  DialogContent as ShadcnDialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type DialogContentProps = Pick<
  ComponentProps<typeof ShadcnDialogContent>,
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
    <ShadcnDialogContent
      showCloseButton={false}
      {...hooks}
      className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm flex-col gap-5 overflow-hidden rounded-xl border-neutral-600 bg-neutral-950 text-white shadow-none sm:max-w-sm"
    >
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto [&>*]:shrink-0">
        <DialogHeader className="gap-5 text-center sm:text-center">
          <DialogTitle className="text-xl font-normal leading-normal">{title}</DialogTitle>
          <DialogDescription className="text-center text-sm text-neutral-400">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </div>
      <DialogClose asChild>
        <Button
          type="button"
          variant="multiplayer"
          disabled={closeDisabled}
          className="border-transparent bg-transparent text-neutral-400"
        >
          Close
        </Button>
      </DialogClose>
    </ShadcnDialogContent>
  );
}
