import { useEffect, useRef, useState } from "react";
import { AlertDialog, Dialog, DropdownMenu } from "radix-ui";
import { ArrowLeft, ChevronDown, MoreHorizontal, Plus, RefreshCw, Search, X } from "lucide-react";
import { AvatarEditor, type AvatarDraft } from "@/components/AvatarEditor";
import { Avatar } from "@/components/Avatar";
import { accountAPI, adminAPI, type Account, type ManagedUser } from "@/transport/account";
import "./AdminScreen.css";

const usernameHint = "3–24 letters, digits, or underscores";
const pageSize = 20;
const exactDate = (value: string | null) => (value ? new Date(value).toLocaleString() : "Unknown");
function relativeDate(value: string | null) {
  if (!value) return "Unknown";
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  for (const [unit, length] of [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ] as const) {
    if (seconds >= length)
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        -Math.floor(seconds / length),
        unit,
      );
  }
}
type Confirmation = { user: ManagedUser; action: "reset" | "delete" };
type Sort = "username" | "createdAt" | "lastSeenAt";

export function AdminScreen({
  onBack,
  onAccountSaved,
}: {
  onBack: () => void;
  onAccountSaved: (account: Account) => void;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ManagedUser>();
  const [secret, setSecret] = useState<{ username: string; password: string }>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("username");
  const [page, setPage] = useState(0);
  const inFlight = useRef(false);
  const panelOrigin = useRef<HTMLButtonElement | null>(null);
  const busy = Boolean(pending);
  useEffect(() => {
    let active = true;
    adminAPI
      .users()
      .then(({ users }) => {
        if (active) {
          setUsers(users);
          setLoaded(true);
        }
      })
      .catch((failure: unknown) => {
        if (active)
          setListError(failure instanceof Error ? failure.message : "Unable to list users");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function refresh() {
    setLoading(true);
    setListError("");
    try {
      setUsers((await adminAPI.users()).users);
      setLoaded(true);
    } catch (failure) {
      setListError(failure instanceof Error ? failure.message : "Unable to list users");
    } finally {
      setLoading(false);
    }
  }
  async function run(label: string, action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(label);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Request failed. Try again");
    } finally {
      inFlight.current = false;
      setPending("");
    }
  }
  function showSecret(username: string, password: string) {
    setSecret({ username, password });
    setCopyStatus("");
  }
  const filtered = users
    .filter((user) => user.username.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (sort === "username") return a.username.localeCompare(b.username);
      return (
        (b[sort] ? new Date(b[sort]).getTime() : 0) - (a[sort] ? new Date(a[sort]).getTime() : 0) ||
        a.id - b.id
      );
    });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return (
    <main className="admin-shell">
      <div className="admin-directory">
        <button className="admin-back" onClick={onBack} disabled={busy}>
          <ArrowLeft size={16} /> Back to game
        </button>
        <header className="admin-header">
          <div>
            <h1>
              Users <span className="admin-count">{loaded ? users.length : "—"}</span>
            </h1>
            <p>Manage driver accounts and access.</p>
          </div>
          <button
            className="admin-button admin-primary"
            disabled={busy || loading || !loaded}
            onClick={(event) => {
              panelOrigin.current = event.currentTarget;
              setError("");
              setCreating(true);
            }}
          >
            <Plus size={17} /> Create user
          </button>
        </header>
        <p className="admin-notice" role="status">
          {notice}
        </p>
        {secret && (
          <section className="admin-credential" aria-label="Temporary credential">
            <div>
              <h2>Temporary password for {secret.username}</h2>
              <p>Copy now and share manually. It cannot be revealed later.</p>
            </div>
            <div className="admin-credential-controls">
              <label className="admin-sr-only" htmlFor="temporary-password">
                Temporary password
              </label>
              <input
                id="temporary-password"
                className="admin-input admin-password"
                readOnly
                autoComplete="off"
                value={secret.password}
                onFocus={(event) => event.target.select()}
              />
              <button
                className="admin-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(secret.password);
                    setCopyStatus("Password copied");
                  } catch {
                    setCopyStatus("Couldn't copy. Select the password and copy manually.");
                  }
                }}
              >
                Copy password
              </button>
              <button
                className="admin-icon-button"
                aria-label="Dismiss password"
                onClick={() => setSecret(undefined)}
              >
                <X size={18} />
              </button>
            </div>
            {copyStatus && <p role="status">{copyStatus}</p>}
          </section>
        )}
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={17} />
            <span className="admin-sr-only">Search users</span>
            <input
              placeholder="Search users…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <label className="admin-sort">
            Sort by{" "}
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as Sort);
                setPage(0);
              }}
            >
              <option value="username">Username</option>
              <option value="createdAt">Newest created</option>
              <option value="lastSeenAt">Recently seen</option>
            </select>
            <ChevronDown size={14} />
          </label>
          <button
            className="admin-button"
            disabled={loading || busy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} />
            {loading && loaded ? "Refreshing…" : "Refresh users"}
          </button>
        </div>
        {listError && (
          <div className="admin-error" role="alert">
            {listError}{" "}
            <button
              className="admin-text-button"
              disabled={loading || busy}
              onClick={() => void refresh()}
            >
              Retry
            </button>
          </div>
        )}
        <div className="admin-table-wrap" aria-busy={loading}>
          {loading && !loaded ? (
            <p className="admin-empty" role="status">
              Loading users…
            </p>
          ) : !loaded ? (
            <p className="admin-empty">Users couldn't be loaded. Retry to reconnect.</p>
          ) : (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Created</th>
                    <th scope="col">
                      Last seen{" "}
                      <span
                        className="admin-help"
                        tabIndex={0}
                        aria-label="Last seen reflects observed authenticated activity, not live presence."
                      >
                        ?
                        <span role="tooltip">
                          Last seen reflects observed authenticated activity, not live presence.
                        </span>
                      </span>
                    </th>
                    <th scope="col">
                      <span className="admin-sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((user) => (
                    <tr key={user.id}>
                      <td className="admin-user">
                        <Avatar username={user.username} avatar={user.avatar} />
                        <span className="admin-username">{user.username}</span>
                        {user.admin && <span className="admin-badge">Admin</span>}
                      </td>
                      <td data-label="Created">
                        <time
                          title={exactDate(user.createdAt)}
                          dateTime={user.createdAt ?? undefined}
                        >
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Unknown"}
                        </time>
                      </td>
                      <td data-label="Last seen">
                        <time
                          title={exactDate(user.lastSeenAt)}
                          dateTime={user.lastSeenAt ?? undefined}
                        >
                          {relativeDate(user.lastSeenAt)}
                        </time>
                      </td>
                      <td className="admin-actions">
                        <button
                          className="admin-button"
                          aria-label={`Edit ${user.username}`}
                          disabled={busy || loading}
                          onClick={(event) => {
                            panelOrigin.current = event.currentTarget;
                            setError("");
                            setEditing(user);
                          }}
                        >
                          Edit
                        </button>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger
                            className="admin-icon-button"
                            disabled={busy || loading}
                            aria-label={`More actions for ${user.username}`}
                          >
                            <MoreHorizontal size={20} />
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content className="admin-menu" align="end" sideOffset={6}>
                              <DropdownMenu.Item
                                onSelect={() => {
                                  setError("");
                                  setConfirmation({ user, action: "reset" });
                                }}
                              >
                                Reset password
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item
                                className="admin-danger-text"
                                disabled={user.admin}
                                onSelect={() => {
                                  setError("");
                                  setConfirmation({ user, action: "delete" });
                                }}
                              >
                                Delete user
                              </DropdownMenu.Item>
                              {user.admin && (
                                <p className="admin-menu-note">
                                  The configured admin cannot be deleted.
                                </p>
                              )}
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="admin-empty">
                  <h2>{users.length ? "No matching users" : "No users yet"}</h2>
                  <p>
                    {users.length
                      ? "Try another username or clear your search."
                      : "Create a user to give a driver access."}
                  </p>
                  {users.length > 0 && (
                    <button
                      className="admin-button"
                      onClick={() => {
                        setQuery("");
                        setPage(0);
                      }}
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {loaded && (
          <footer className="admin-pagination">
            <span>
              {filtered.length
                ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, filtered.length)} of ${filtered.length} users`
                : "0 users"}
            </span>
            <div>
              <button
                className="admin-button"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              <span>
                Page {currentPage + 1} of {pages}
              </span>
              <button
                className="admin-button"
                disabled={currentPage + 1 >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </footer>
        )}
      </div>
      <Dialog.Root
        open={creating}
        onOpenChange={(open) => {
          if (!busy) setCreating(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="admin-overlay" />
          <Dialog.Content
            className="admin-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              panelOrigin.current?.focus();
            }}
          >
            <Dialog.Title>Create user</Dialog.Title>
            <Dialog.Description>Give a driver access with a temporary password.</Dialog.Description>
            <CreateUserForm
              busy={busy}
              error={error}
              onSubmit={(username) =>
                void run("create", async () => {
                  const result = await adminAPI.create(username);
                  setUsers((current) => [
                    ...current,
                    { ...result.user, createdAt: null, lastSeenAt: null },
                  ]);
                  showSecret(result.user.username, result.temporaryPassword);
                  setCreating(false);
                  setQuery("");
                  setPage(0);
                  setNotice(`User ${result.user.username} created`);
                  await refresh();
                })
              }
            />
            <Dialog.Close
              className="admin-icon-button admin-close"
              aria-label="Close create user"
              disabled={busy}
            >
              <X size={20} />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(undefined);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="admin-overlay" />
          <Dialog.Content
            className="admin-drawer"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              panelOrigin.current?.focus();
            }}
          >
            <Dialog.Title>Edit user</Dialog.Title>
            <Dialog.Description>Update {editing?.username}'s profile.</Dialog.Description>
            {editing && (
              <ProfileEditor
                key={editing.id}
                user={editing}
                busy={busy}
                error={error}
                onError={setError}
                onCancel={() => setEditing(undefined)}
                onSave={(name, avatar) =>
                  void run("save", async () => {
                    const next = await adminAPI.update(editing.id, name, avatar);
                    setUsers((current) =>
                      current.map((item) => (item.id === editing.id ? { ...item, ...next } : item)),
                    );
                    setEditing(undefined);
                    setNotice("Profile saved");
                    if (editing.admin) {
                      try {
                        onAccountSaved(await accountAPI.current());
                      } catch {
                        setNotice("Profile saved. Reload to update your account details.");
                      }
                    }
                  })
                }
              />
            )}
            <Dialog.Close
              className="admin-icon-button admin-close"
              disabled={busy}
              aria-label="Close editor"
            >
              <X size={20} />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <AlertDialog.Root
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(undefined);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="admin-overlay" />
          <AlertDialog.Content className="admin-dialog">
            <AlertDialog.Title>
              {confirmation?.action === "delete" ? "Delete user permanently?" : "Reset password?"}
            </AlertDialog.Title>
            <AlertDialog.Description>
              <strong>{confirmation?.user.username}</strong>:{" "}
              {confirmation?.action === "delete"
                ? "Permanently removes this account and avatar."
                : "Generates a new temporary password."}{" "}
              All devices will be logged out and multiplayer participation will end.
            </AlertDialog.Description>
            {error && (
              <p className="admin-error" role="alert">
                {error}
              </p>
            )}
            <div className="admin-form-actions">
              <AlertDialog.Cancel className="admin-button" disabled={busy}>
                Cancel
              </AlertDialog.Cancel>
              <button
                className={`admin-button ${confirmation?.action === "delete" ? "admin-destructive" : "admin-primary"}`}
                disabled={busy}
                onClick={() => {
                  if (!confirmation) return;
                  void run(confirmation.action, async () => {
                    const { user, action } = confirmation;
                    if (action === "delete") {
                      await adminAPI.delete(user.id);
                      setUsers((current) => current.filter((item) => item.id !== user.id));
                      setNotice(`User ${user.username} deleted`);
                    } else {
                      const result = await adminAPI.reset(user.id);
                      showSecret(user.username, result.temporaryPassword);
                    }
                    setConfirmation(undefined);
                  });
                }}
              >
                {busy
                  ? pending === "delete"
                    ? "Deleting…"
                    : "Resetting…"
                  : confirmation?.action === "delete"
                    ? "Permanently delete"
                    : "Confirm reset"}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </main>
  );
}

function CreateUserForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  onSubmit: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(username);
      }}
    >
      <label>
        New username
        <input
          className="admin-input"
          value={username}
          disabled={busy}
          required
          pattern="[A-Za-z0-9_]{3,24}"
          minLength={3}
          maxLength={24}
          aria-describedby="create-username-hint"
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <p id="create-username-hint" className="admin-hint">
        {usernameHint}
      </p>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-form-actions">
        <Dialog.Close className="admin-button" disabled={busy}>
          Cancel
        </Dialog.Close>
        <button className="admin-button admin-primary" disabled={busy}>
          {busy ? "Creating…" : "Create user"}
        </button>
      </div>
    </form>
  );
}

function ProfileEditor({
  user,
  busy,
  error,
  onSave,
  onCancel,
  onError,
}: {
  user: ManagedUser;
  busy: boolean;
  error: string;
  onSave: (username: string, avatar?: string) => void;
  onCancel: () => void;
  onError: (error: string) => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [{ value: avatar, reading }, setAvatarDraft] = useState<AvatarDraft>({ reading: false });
  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (reading) return;
        if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
          onError(`Username must contain ${usernameHint}`);
          return;
        }
        onSave(username, avatar);
      }}
    >
      <div className="admin-avatar-editor">
        <AvatarEditor
          username={username}
          avatar={user.avatar}
          disabled={busy}
          onChange={setAvatarDraft}
          onError={onError}
        />
      </div>
      <label>
        Username
        <input
          className="admin-input"
          value={username}
          disabled={busy}
          maxLength={24}
          aria-describedby="edit-username-hint"
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <p className="admin-hint" id="edit-username-hint">
        {usernameHint}
      </p>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-form-actions">
        <button type="button" className="admin-button" disabled={busy} onClick={onCancel}>
          Cancel edit
        </button>
        <button className="admin-button admin-primary" disabled={busy || reading}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
