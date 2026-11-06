import { Button } from "@/components/ui/button";
import { InlineFeedback } from "@/components/ui/inline-feedback";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
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
  return (
    <>
      <div aria-live="polite" aria-busy={!data && !error}>
        {error ? (
          <InlineFeedback
            tone="error"
            retry={{
              onClick: () => {
                setError("");
                setAttempt(attempt + 1);
              },
            }}
          >
            {error}
          </InlineFeedback>
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
        <Button
          variant="multiplayer"

          disabled={page === 0 || (!data && !error)}
          onClick={() => navigate(page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-neutral-400">Page {page + 1}</span>
        <Button variant="multiplayer" disabled={!data?.hasNext} onClick={() => navigate(page + 1)}>
          Next
        </Button>
      </div>
    </>
  );
}

export function RaceHistoryDialog({
  authenticated,
  onLogin,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  authenticated: boolean;
  onLogin?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open === undefined && (
        <DialogTrigger className="rounded-lg border border-neutral-600 px-3 py-2 text-sm text-white">
          Race History
        </DialogTrigger>
      )}
      <DialogContent
        title="Race History"
        description="Your completed races, newest first."
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {authenticated ? (
          <History />
        ) : (
          <>
            <p>Sign in to view your race history.</p>
            <DialogClose asChild>
              <Button variant="multiplayer" onClick={onLogin}>
                Sign in
              </Button>
            </DialogClose>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
