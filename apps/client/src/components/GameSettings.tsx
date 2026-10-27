import { useState } from "react";
import { Settings } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";
import type { UISnapshot } from "@/game/GameSession";

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
      className="game-settings"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        className="settings-trigger"
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
        <div className="settings-panel" role="dialog" aria-label="Game settings">
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
