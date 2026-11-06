"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

type DialogContentProps = Pick<
  React.ComponentProps<typeof DialogPrimitive.Content>,
  "onOpenAutoFocus" | "onCloseAutoFocus" | "onEscapeKeyDown" | "onInteractOutside"
> & {
  title: string;
  description: string;
  closeDisabled?: boolean;
  children: React.ReactNode;
};

export function DialogContent({
  title,
  description,
  closeDisabled,
  children,
  ...hooks
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-black/75"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        {...hooks}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-hidden rounded-xl border border-neutral-600 bg-neutral-950 p-6 text-white outline-none"
      >
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto [&>*]:shrink-0">
          <div data-slot="dialog-header" className="flex flex-col gap-5 text-center">
            <DialogPrimitive.Title
              data-slot="dialog-title"
              className="text-xl font-normal leading-normal"
            >
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description
              data-slot="dialog-description"
              className="text-center text-sm text-neutral-400"
            >
              {description}
            </DialogPrimitive.Description>
          </div>
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
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Dialog, DialogClose, DialogTrigger };
