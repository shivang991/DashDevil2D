import { useState } from "react";
import { Dialog } from "radix-ui";
import type { Account } from "@/transport/account";

export function ProfileDialog({
  account,
  onLogout,
}: {
  account: Account;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError("");
      }}
    >
      <Dialog.Trigger className="rounded-lg border border-neutral-600 px-3 py-2 text-sm text-white">
        Profile
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-xl border border-neutral-600 bg-neutral-950 p-6 text-white">
          <Dialog.Title className="text-xl">Profile</Dialog.Title>
          <Dialog.Description className="text-sm text-neutral-400">
            {account.username}
            {account.admin ? " · Admin" : ""}
          </Dialog.Description>
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="rounded-lg border border-neutral-600 px-4 py-3 disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onLogout();
              } catch (failure) {
                setError(failure instanceof Error ? failure.message : "Unable to log out");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Logging out…" : "Logout"}
          </button>
          <Dialog.Close className="text-sm text-neutral-400">Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
