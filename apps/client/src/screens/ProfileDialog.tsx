import { InlineFeedback } from "@/components/ui/inline-feedback";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { useState } from "react";
import { AvatarEditor, type AvatarDraft } from "@/components/AvatarEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
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
    <Dialog
      open={controlledOpen ?? open}
      onOpenChange={(next) => {
        if (busy) return;
        reset(account);
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      {controlledOpen === undefined && (
        <DialogTrigger className="rounded-lg border border-neutral-600 px-3 py-2 text-sm text-white">
          Profile
        </DialogTrigger>
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
        {error && <InlineFeedback tone="error">{error}</InlineFeedback>}
        {notice && <InlineFeedback tone="success">{notice}</InlineFeedback>}
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
            <FormField label="Current password">
              <Input
                type="password"
                autoComplete="current-password"
                required
                maxLength={4096}
                disabled={busy}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </FormField>
            <FormField label="New password">
              <Input
                type="password"
                autoComplete="new-password"
                required
                maxLength={2048}
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <FormField label="Confirm new password">
              <Input
                type="password"
                autoComplete="new-password"
                required
                maxLength={2048}
                disabled={busy}
                aria-invalid={
                  (error === "Passwords do not match" && password !== confirmation) || undefined
                }
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </FormField>
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
    </Dialog>
  );
}
