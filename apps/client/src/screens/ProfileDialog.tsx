import { useState } from "react";
import { AvatarEditor, type AvatarDraft } from "@/components/AvatarEditor";
import { Button } from "@/components/ui/button";
import { Dialog } from "radix-ui";
import { DialogContent } from "@/components/ui/dialog-content";
import { accountAPI, type Account } from "@/transport/account";

export function ProfileDialog({
  account,
  open: controlledOpen,
  onOpenChange,
  onCloseAutoFocus,
  onSaved,
}: {
  account: Account;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  onSaved?: (account: Account) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(account);
  const [passwordMode, setPasswordMode] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [{ value: avatar, reading }, setAvatarDraft] = useState<AvatarDraft>({ reading: false });
  const [avatarReset, setAvatarReset] = useState(0);
  const dirty = avatar !== undefined || reading;
  const input = "w-full rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-2 text-white";
  function reset(next: Account) {
    setAvatarDraft({ reading: false });
    setAvatarReset((value) => value + 1);
    setSaved(next);
    setPasswordMode(false);
    setCurrentPassword("");
    setPassword("");
    setConfirmation("");
    setError("");
    setNotice("");
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save. Try again");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root
      open={controlledOpen ?? open}
      onOpenChange={(next) => {
        if (busy) return;
        reset(account);
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      {controlledOpen === undefined && (
        <Dialog.Trigger className="rounded-lg border border-neutral-600 px-3 py-2 text-sm text-white">
          Profile
        </Dialog.Trigger>
      )}
      <DialogContent
        title={passwordMode ? "Change password" : "Profile"}
        description={
          passwordMode ? "Change your account password." : "Manage your avatar and password."
        }
        closeDisabled={busy}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-green-400">
            {notice}
          </p>
        )}
        {passwordMode ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (password !== confirmation) {
                setError("Passwords do not match");
                return;
              }
              void run(async () => {
                const next = await accountAPI.changePassword(currentPassword, password);
                reset(next);
                onSaved?.(next);
                setNotice("Password changed. Other devices logged out.");
              });
            }}
          >
            <label className="text-sm">
              Current password
              <input
                className={input}
                type="password"
                autoComplete="current-password"
                required
                maxLength={4096}
                disabled={busy}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label className="text-sm">
              New password
              <input
                className={input}
                type="password"
                autoComplete="new-password"
                required
                maxLength={2048}
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Confirm new password
              <input
                className={input}
                type="password"
                autoComplete="new-password"
                required
                maxLength={2048}
                disabled={busy}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <p className="text-xs text-neutral-400">Other devices will be logged out.</p>
            <Button variant="multiplayer" disabled={busy}>
              {busy ? "Saving…" : "Save password"}
            </Button>
            <Button
              type="button"
              variant="multiplayer"
              disabled={busy}
              onClick={() => reset(saved)}
            >
              Back
            </Button>
          </form>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (reading) return;
              void run(async () => {
                const next = await accountAPI.updateProfile(avatar);
                reset(next);
                onSaved?.(next);
                setNotice("Profile saved");
              });
            }}
          >
            <AvatarEditor
              key={avatarReset}
              username={saved.username}
              avatar={saved.avatar}
              disabled={busy}
              onChange={setAvatarDraft}
              onError={setError}
              onSelect={() => setNotice("")}
            />
            <p className="break-all text-center">{saved.username}</p>
            {dirty ? (
              <Button variant="multiplayer" disabled={busy || reading}>
                {reading ? "Processing…" : busy ? "Saving…" : "Save"}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="multiplayer"
                  disabled={busy}
                  onClick={() => {
                    setPasswordMode(true);
                    setNotice("");
                    setError("");
                  }}
                >
                  Change password
                </Button>
              </>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog.Root>
  );
}
