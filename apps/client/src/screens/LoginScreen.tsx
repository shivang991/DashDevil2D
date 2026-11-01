import { useState, type FormEvent } from "react";
import { accountAPI, type Account } from "@/transport/account";

export function LoginScreen({
  account,
  onAuthenticated,
  onBack,
  onLogout,
}: {
  account?: Account;
  onAuthenticated: (account: Account) => void;
  onBack: () => void;
  onLogout: () => Promise<void>;
}) {
  const temporary = Boolean(account?.mustChangePassword);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!temporary && !/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      setError("Username must contain 3–24 letters, digits, or underscores");
      return;
    }
    if ([...password].length < 12 || [...password].length > 1024) {
      setError("Password must contain 12–1024 characters");
      return;
    }
    if (temporary && password !== confirmation) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const next = temporary
        ? await accountAPI.changeTemporaryPassword(password)
        : await accountAPI.login(username, password);
      setPassword("");
      setConfirmation("");
      onAuthenticated(next);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to log in");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 text-white">
      <div className="flex w-full max-w-96 flex-col gap-6 p-6">
        <div className="rounded-xl border border-neutral-700 px-6 py-8 text-center text-xl">
          Branding
        </div>
        <h1 className="text-xl">{temporary ? "Change temporary password" : "Login"}</h1>
        {temporary && (
          <p className="text-sm text-neutral-400">
            {account?.username}, choose a new password before continuing.
          </p>
        )}
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          {!temporary && (
            <label className="flex flex-col gap-2 text-sm">
              Username
              <input
                autoFocus
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                minLength={3}
                maxLength={24}
                pattern="[A-Za-z0-9_]{3,24}"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-3"
              />
            </label>
          )}
          <label className="flex flex-col gap-2 text-sm">
            {temporary ? "New password" : "Password"}
            <input
              autoFocus={temporary}
              type="password"
              autoComplete={temporary ? "new-password" : "current-password"}
              required
              minLength={12}
              maxLength={2048}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="password-rules"
              className="rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-3"
            />
          </label>
          <p id="password-rules" className="text-xs text-neutral-400">
            At least 12 characters. Spaces and pasting allowed.
          </p>
          {temporary && (
            <label className="flex flex-col gap-2 text-sm">
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-3"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="rounded-xl border border-neutral-500 bg-neutral-800 px-4 py-3 disabled:opacity-50"
          >
            {busy ? "Please wait…" : temporary ? "Save password" : "Login"}
          </button>
        </form>
        <button
          disabled={busy}
          className="text-sm text-neutral-400 disabled:opacity-50"
          onClick={() => {
            if (temporary)
              void onLogout().catch((failure: unknown) =>
                setError(failure instanceof Error ? failure.message : "Unable to log out"),
              );
            else onBack();
          }}
        >
          {temporary ? "Logout" : "Back"}
        </button>
      </div>
    </main>
  );
}
