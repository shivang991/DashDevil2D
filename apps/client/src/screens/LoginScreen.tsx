import { Button } from "@/components/ui/button";
import { InlineFeedback } from "@/components/ui/inline-feedback";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
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
    if ([...password].length < 6 || [...password].length > 1024) {
      setError("Password must contain 6–1024 characters");
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
    <main className="flex min-h-[var(--app-page-height,100dvh)] items-center justify-center bg-neutral-950 text-white">
      <div className="flex w-full max-w-96 flex-col gap-6 p-6">
        <div className="flex justify-center py-2">
          <img
            src={`${import.meta.env.BASE_URL}images/branding/dash-devil-logo.png`}
            alt="Dash Devil"
            className="h-auto w-64 max-w-full [image-rendering:pixelated]"
          />
        </div>
        <h1 className="text-xl">{temporary ? "Change temporary password" : "Login"}</h1>
        {temporary && (
          <p className="text-sm text-neutral-400">
            {account?.username}, choose a new password before continuing.
          </p>
        )}
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          {!temporary && (
            <FormField label="Username">
              <Input
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
              />
            </FormField>
          )}
          <FormField
            label={temporary ? "New password" : "Password"}
            hintId="password-rules"
            hint="At least 6 characters. Spaces and pasting allowed."
          >
            <Input
              autoFocus={temporary}
              type="password"
              autoComplete={temporary ? "new-password" : "current-password"}
              required
              minLength={6}
              maxLength={2048}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="password-rules"
            />
          </FormField>
          {temporary && (
            <FormField label="Confirm new password">
              <Input
                type="password"
                autoComplete="new-password"
                required
                aria-invalid={
                  (error === "Passwords do not match" && password !== confirmation) || undefined
                }
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </FormField>
          )}
          {error && <InlineFeedback tone="error">{error}</InlineFeedback>}
          <Button disabled={busy} type="submit" variant="multiplayer">
            {busy ? "Please wait…" : temporary ? "Save password" : "Login"}
          </Button>
        </form>
        <Button
          disabled={busy}
          type="button"
          variant="text"
          onClick={() => {
            if (temporary)
              void onLogout().catch((failure: unknown) =>
                setError(failure instanceof Error ? failure.message : "Unable to log out"),
              );
            else onBack();
          }}
        >
          {temporary ? "Logout" : "Back"}
        </Button>
      </div>
    </main>
  );
}
