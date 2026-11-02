import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { accountAPI, type RaceHistoryPage } from "@/transport/account";

function History() {
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<RaceHistoryPage>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    accountAPI.history(page).then(
      (next) => {
        if (active) setData(next);
      },
      (failure: unknown) => {
        if (active)
          setError(failure instanceof Error ? failure.message : "Unable to load race history");
      },
    );
    return () => {
      active = false;
    };
  }, [page, attempt]);
  function navigate(next: number) {
    setData(undefined);
    setError("");
    setPage(next);
  }
  const button = "rounded-lg border border-neutral-600 px-3 py-2 text-sm disabled:opacity-50";
  return (
    <>
      <div aria-live="polite" aria-busy={!data && !error}>
        {error ? (
          <div role="alert" className="space-y-3">
            <p className="text-red-400">{error}</p>
            <button
              className={button}
              onClick={() => {
                setError("");
                setAttempt(attempt + 1);
              }}
            >
              Retry
            </button>
          </div>
        ) : !data ? (
          <p className="text-neutral-400">Loading races…</p>
        ) : data.races.length === 0 ? (
          <p className="text-neutral-400">
            {page === 0
              ? "No completed races yet. Play Drag Race or Road Rage to get started."
              : "No more races."}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {data.races.map((race) => (
              <li key={`${race.id}:${race.seat}`} className="py-3 space-y-1">
                <div className="flex justify-between gap-3">
                  <span>{race.mode === "drag-race" ? "Drag Race" : "Road Rage"}</span>
                  <span
                    className={
                      race.result === "win"
                        ? "text-green-400"
                        : race.result === "loss"
                          ? "text-red-400"
                          : "text-neutral-300"
                    }
                  >
                    {race.result === "win" ? "Win" : race.result === "loss" ? "Loss" : "Tie"}
                  </span>
                </div>
                <p className="text-sm break-words">vs {race.opponent}</p>
                <time className="text-xs text-neutral-400" dateTime={race.startedAt}>
                  {new Date(race.startedAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          className={button}
          disabled={page === 0 || (!data && !error)}
          onClick={() => navigate(page - 1)}
        >
          Previous
        </button>
        <span className="text-sm text-neutral-400">Page {page + 1}</span>
        <button className={button} disabled={!data?.hasNext} onClick={() => navigate(page + 1)}>
          Next
        </button>
      </div>
    </>
  );
}

export function RaceHistoryDialog({
  authenticated,
  onLogin,
}: {
  authenticated: boolean;
  onLogin?: () => void;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="rounded-lg border border-neutral-600 px-3 py-2 text-sm text-white">
        Race History
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-xl border border-neutral-600 bg-neutral-950 p-6 text-white">
          <Dialog.Title className="text-xl">Race History</Dialog.Title>
          <Dialog.Description className="text-sm text-neutral-400">
            Your completed races, newest first.
          </Dialog.Description>
          {authenticated ? (
            <History />
          ) : (
            <>
              <p>Sign in to view your race history.</p>
              <Dialog.Close asChild>
                <button
                  className="rounded-lg border border-neutral-600 px-3 py-2"
                  onClick={onLogin}
                >
                  Sign in
                </button>
              </Dialog.Close>
            </>
          )}
          <Dialog.Close className="text-sm text-neutral-400">Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
