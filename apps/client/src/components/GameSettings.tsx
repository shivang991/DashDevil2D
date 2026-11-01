import { settingsPanel } from "@/components/ui/styles";
import { useState } from "react";
import { Settings } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";
import type { UISnapshot } from "@/game/long-drive/LongDriveSession";

export function GameSettings({
  ui,
  onCommand,
  onFocus,
  onBack,
}: {
  ui: UISnapshot;
  onCommand?: (command: "pause" | "reset") => void;
  onFocus?: () => void;
  onBack?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(gameAudio.enabled);
  const close = () => {
    setOpen(false);
    onFocus?.();
  };
  return (
    <div
      className="absolute top-[max(4px,env(safe-area-inset-top))] right-1 z-30"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        className="grid size-11 place-items-center rounded-[10px] text-neutral-300 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => {
          if (open) close();
          else {
            if (ui.status === "playing" && !ui.paused) onCommand?.("pause");
            setOpen(true);
          }
        }}
      >
        <Settings size={22} aria-hidden="true" />
      </button>
      {open && (
        <div className={settingsPanel} role="dialog" aria-label="Game settings">
          {ui.status === "playing" && (
            <button
              onClick={() => {
                onCommand?.("pause");
                close();
              }}
            >
              {ui.paused ? "Resume" : "Pause"}
            </button>
          )}
          <button
            onClick={() => {
              onCommand?.("reset");
              close();
            }}
          >
            Restart
          </button>
          <button
            aria-label={sound ? "Mute sound" : "Enable sound"}
            onClick={() => {
              gameAudio.setEnabled(!gameAudio.enabled);
              setSound(gameAudio.enabled);
            }}
          >
            Sound {sound ? "on" : "off"}
          </button>
          {onBack && <button onClick={onBack}>Back to Menu</button>}
          <button onClick={close}>Close</button>
        </div>
      )}
    </div>
  );
}
