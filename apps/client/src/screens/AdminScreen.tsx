import { Fragment, useEffect, useRef, useState } from "react";
import { AlertDialog } from "radix-ui";
import { Avatar } from "@/components/Avatar";
import { accountAPI, adminAPI, type Account, type ManagedUser } from "@/transport/account";

const button = "rounded-lg border border-neutral-600 px-3 py-2 text-sm disabled:opacity-50";
const input = "w-full rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-2 text-white";
const date = (value: string | null) => (value ? new Date(value).toLocaleString() : "Unknown");

export function AdminScreen({
  onBack,
  onAccountSaved,
}: {
  onBack: () => void;
  onAccountSaved: (account: Account) => void;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [editing, setEditing] = useState<number>();
  const [secret, setSecret] = useState<{ username: string; password: string }>();
  const [confirmation, setConfirmation] = useState<{
    user: ManagedUser;
    action: "reset" | "delete";
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    adminAPI
      .users()
      .then(({ users }) => {
        if (active) setUsers(users);
      })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : "Unable to list users");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function refresh() {
    setUsers((await adminAPI.users()).users);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Request failed. Try again");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-dvh bg-neutral-950 p-4 text-white sm:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="flex items-center justify-between">
          <h1 className="text-xl">Admin</h1>
          <button className={button} disabled={busy} onClick={onBack}>
            Back
          </button>
        </header>
        <div role="tablist" aria-label="Admin">
          <button
            role="tab"
            aria-selected="true"
            aria-controls="users-panel"
            id="users-tab"
            className={button}
          >
            Users
          </button>
        </div>
        <section
          role="tabpanel"
          id="users-panel"
          aria-labelledby="users-tab"
          className="flex flex-col gap-5"
        >
          <p className="text-sm text-neutral-400">
            Last seen reflects observed authenticated activity, not live presence.
          </p>
          {error && !confirmation && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-green-400">
              {notice}
            </p>
          )}
          {secret && (
            <section
              aria-label="Temporary credential"
              className="flex flex-col gap-3 rounded-xl border border-neutral-600 p-4"
            >
              <p className="text-sm">
                Temporary password for {secret.username}. Copy now and share manually. It cannot be
                revealed later.
              </p>
              <label className="text-sm">
                Temporary password
                <input
                  className={`${input} font-mono`}
                  readOnly
                  autoComplete="off"
                  value={secret.password}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <div className="flex gap-3">
                <button
                  className={button}
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(secret.password);
                      setNotice("Password copied");
                    })
                  }
                >
                  Copy password
                </button>
                <button className={button} disabled={busy} onClick={() => setSecret(undefined)}>
                  Dismiss password
                </button>
              </div>
            </section>
          )}
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                setSecret(undefined);
                const result = await adminAPI.create(username);
                setSecret({ username: result.user.username, password: result.temporaryPassword });
                setUsername("");
                await refresh();
              });
            }}
          >
            <label className="text-sm">
              New username
              <input
                className={input}
                value={username}
                disabled={busy}
                required
                maxLength={24}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <button className={button} disabled={busy || loading}>
              Create user
            </button>
          </form>
          {loading ? (
            <p role="status">Loading users…</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-900">
                  <tr>
                    {["User", "Created", "Last seen", "Actions"].map((title) => (
                      <th key={title} className="p-3 font-normal text-neutral-400">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <Fragment key={user.id}>
                      <tr className="border-t border-neutral-700">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <Avatar username={user.username} avatar={user.avatar} />
                            <span>{user.username}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-neutral-400">{date(user.createdAt)}</td>
                        <td className="p-3 text-xs text-neutral-400">{date(user.lastSeenAt)}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className={button}
                              disabled={busy}
                              aria-expanded={editing === user.id}
                              aria-controls={`edit-${user.id}`}
                              onClick={() => {
                                setEditing(editing === user.id ? undefined : user.id);
                                setError("");
                                setNotice("");
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className={button}
                              disabled={busy}
                              onClick={() => setConfirmation({ user, action: "reset" })}
                            >
                              Reset password
                            </button>
                            <button
                              className={button}
                              disabled={busy || user.admin}
                              title={
                                user.admin ? "The configured admin cannot be deleted" : undefined
                              }
                              onClick={() => setConfirmation({ user, action: "delete" })}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editing === user.id && (
                        <tr id={`edit-${user.id}`}>
                          <td
                            colSpan={4}
                            className="border-t border-neutral-700 bg-neutral-900/50 p-4"
                          >
                            <ProfileEditor
                              key={user.id}
                              user={user}
                              busy={busy}
                              onError={setError}
                              onCancel={() => setEditing(undefined)}
                              onSave={(name, avatar) =>
                                void run(async () => {
                                  const next = await adminAPI.update(user.id, name, avatar);
                                  setUsers((current) =>
                                    current.map((item) =>
                                      item.id === user.id ? { ...item, ...next } : item,
                                    ),
                                  );
                                  setEditing(undefined);
                                  setNotice("Profile saved");
                                  if (user.admin) onAccountSaved(await accountAPI.current());
                                })
                              }
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            className={`${button} self-start`}
            disabled={busy || loading}
            onClick={() => void run(refresh)}
          >
            Refresh users
          </button>
        </section>
      </div>
      <AlertDialog.Root
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(undefined);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-xl border border-neutral-600 bg-neutral-950 p-6 text-white">
            <AlertDialog.Title>
              {confirmation?.action === "delete" ? "Delete user permanently?" : "Reset password?"}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-neutral-400">
              {confirmation?.user.username}:{" "}
              {confirmation?.action === "delete"
                ? "Permanently removes this account and avatar."
                : "Generates a new temporary password."}{" "}
              All devices will be logged out and multiplayer participation will end.
            </AlertDialog.Description>
            <button
              className={button}
              disabled={busy}
              onClick={() => {
                if (!confirmation) return;
                void run(async () => {
                  setSecret(undefined);
                  const { user, action } = confirmation;
                  if (action === "delete") {
                    await adminAPI.delete(user.id);
                    setUsers((current) => current.filter((item) => item.id !== user.id));
                    setNotice("User deleted");
                  } else {
                    const result = await adminAPI.reset(user.id);
                    setSecret({ username: user.username, password: result.temporaryPassword });
                  }
                  setEditing(undefined);
                  setConfirmation(undefined);
                });
              }}
            >
              {confirmation?.action === "delete" ? "Permanently delete" : "Confirm reset"}
            </button>
            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}
            <AlertDialog.Cancel className={button} disabled={busy}>
              Cancel
            </AlertDialog.Cancel>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </main>
  );
}

function ProfileEditor({
  user,
  busy,
  onSave,
  onCancel,
  onError,
}: {
  user: ManagedUser;
  busy: boolean;
  onSave: (username: string, avatar?: string) => void;
  onCancel: () => void;
  onError: (error: string) => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [avatar, setAvatar] = useState<string>();
  const [preview, setPreview] = useState<string>();
  const [reading, setReading] = useState(false);
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  return (
    <form
      className="flex max-w-sm flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
          onError("Username must contain 3–24 letters, digits, or underscores");
          return;
        }
        onSave(username, avatar);
      }}
    >
      <Avatar
        username={username}
        avatar={avatar === undefined ? user.avatar : ""}
        preview={preview}
      />
      <label className="text-sm">
        Username
        <input
          className={input}
          value={username}
          disabled={busy}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label className="text-sm">
        Avatar
        <input
          className="mt-2 block w-full text-xs"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const current = ++epoch.current;
            setReading(false);
            onError("");
            if (
              file.size === 0 ||
              file.size > 2 * 1024 * 1024 ||
              !["image/jpeg", "image/png", "image/webp"].includes(file.type)
            ) {
              onError("Choose a JPEG, PNG, or WebP up to 2 MB");
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
              if (epoch.current === current) {
                setAvatar(data.split(",")[1]);
                setPreview(data);
              }
            } catch {
              if (epoch.current === current) onError("Unable to read avatar");
            } finally {
              if (epoch.current === current) setReading(false);
            }
          }}
        />
      </label>
      <p className="text-xs text-neutral-400">JPEG, PNG, WebP · up to 2 MB</p>
      {(user.avatar || avatar) && (
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={() => {
            epoch.current++;
            setReading(false);
            setAvatar("");
            setPreview(undefined);
          }}
        >
          Remove avatar
        </button>
      )}
      <div className="flex gap-3">
        <button className={button} disabled={busy || reading}>
          Save
        </button>
        <button type="button" className={button} disabled={busy} onClick={onCancel}>
          Cancel edit
        </button>
      </div>
    </form>
  );
}
