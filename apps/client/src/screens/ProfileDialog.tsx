import { useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Avatar } from "@/components/Avatar";
import { accountAPI, type Account } from "@/transport/account";

export function ProfileDialog({
  account,
  onLogout,
  onSaved,
}: {
  account: Account;
  onLogout: () => Promise<void>;
  onSaved?: (account: Account) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(account);
  const [username, setUsername] = useState(account.username);
  const [avatar, setAvatar] = useState<string>();
  const [preview, setPreview] = useState<string>();
  const [passwordMode, setPasswordMode] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const fileEpoch = useRef(0);
  const dirty = username !== saved.username || avatar !== undefined || reading;
  const button = "rounded-lg border border-neutral-600 px-4 py-3 disabled:opacity-50";
  const input = "w-full rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-2 text-white";
  function reset(next: Account) {
    fileEpoch.current++;
    setReading(false);
    setSaved(next);
    setUsername(next.username);
    setAvatar(undefined);
    setPreview(undefined);
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
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        reset(account);
        setOpen(next);
      }}
    >
      <Dialog.Trigger className="rounded-lg border border-neutral-600 px-3 py-2 text-sm text-white">
        Profile
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-xl border border-neutral-600 bg-neutral-950 p-6 text-white"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <Dialog.Title className="text-xl">
            {passwordMode ? "Change password" : "Profile"}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-neutral-400">
            {passwordMode
              ? "Changing your password logs out other devices."
              : "Edit your username or avatar, then save."}
          </Dialog.Description>
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
              <p className="text-xs text-neutral-400">12–1024 characters; spaces allowed.</p>
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
              <button className={button} disabled={busy}>
                Save password
              </button>
              <button type="button" className={button} disabled={busy} onClick={() => reset(saved)}>
                Back
              </button>
            </form>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
                  setError("Username must contain 3–24 letters, digits, or underscores");
                  return;
                }
                void run(async () => {
                  const next = await accountAPI.updateProfile(username, avatar);
                  reset(next);
                  onSaved?.(next);
                  setNotice("Profile saved");
                });
              }}
            >
              <Avatar
                username={username}
                avatar={avatar === undefined ? saved.avatar : ""}
                preview={preview}
              />
              <label className="text-sm">
                Avatar
                <input
                  type="file"
                  className="mt-2 block w-full text-xs"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    const epoch = ++fileEpoch.current;
                    setReading(false);
                    setError("");
                    setNotice("");
                    if (
                      file.size > 2 * 1024 * 1024 ||
                      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
                    ) {
                      setError("Choose a JPEG, PNG, or WebP up to 2 MB");
                      return;
                    }
                    setReading(true);
                    try {
                      const data = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result));
                        reader.onerror = () => reject(new Error("Unable to read avatar"));
                        reader.readAsDataURL(file);
                      });
                      if (fileEpoch.current === epoch) {
                        setAvatar(data.split(",")[1]);
                        setPreview(data);
                      }
                    } catch {
                      if (fileEpoch.current === epoch) setError("Unable to read avatar");
                    } finally {
                      if (fileEpoch.current === epoch) setReading(false);
                    }
                  }}
                />
              </label>
              <p className="text-xs text-neutral-400">
                JPEG, PNG, WebP · up to 2 MB · max 2048 × 2048
              </p>
              {(saved.avatar || avatar) && (
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => {
                    fileEpoch.current++;
                    setReading(false);
                    setAvatar("");
                    setPreview(undefined);
                  }}
                >
                  Remove avatar
                </button>
              )}
              <label className="text-sm">
                Username
                <input
                  className={input}
                  autoComplete="username"
                  disabled={busy}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setNotice("");
                  }}
                />
              </label>
              {dirty ? (
                <button className={button} disabled={busy || reading}>
                  {busy ? "Saving…" : "Save"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setPasswordMode(true);
                      setNotice("");
                      setError("");
                    }}
                  >
                    Change password
                  </button>
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => void run(onLogout)}
                  >
                    Logout
                  </button>
                </>
              )}
            </form>
          )}
          <Dialog.Close disabled={busy} className="text-sm text-neutral-400">
            Close
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
