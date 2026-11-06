import { Play } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/button";

export function PauseMenu({
  mode,
  onResume,
  children,
}: {
  mode: "race" | "long-drive";
  onResume: () => void;
  children: ReactNode;
}) {
  const race = mode === "race";
  return (
    <div
      id={race ? undefined : "long-drive-pause"}
      role={race ? "dialog" : "region"}
      aria-label={race ? "Race menu" : "Game paused"}
      className="game-overlay absolute inset-0 z-30 flex overflow-auto bg-black/65 p-3"
    >
      <div className="m-auto flex w-36 shrink-0 flex-col gap-2">
        <Button
          autoFocus={race}
          className="min-h-11 bg-red-400 text-neutral-950 hover:bg-red-300"
          onClick={onResume}
        >
          <Play aria-hidden="true" />
          Resume
        </Button>
        {children}
      </div>
    </div>
  );
}
