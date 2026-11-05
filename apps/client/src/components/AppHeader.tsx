import { useSyncExternalStore, type ReactNode } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";

export function AppHeader({ children }: { children: ReactNode }) {
  const enabled = useSyncExternalStore(gameAudio.subscribe, () => gameAudio.enabled);
  const label = enabled ? "Mute sound" : "Enable sound";
  return (
    <header className="app-header" aria-label="App controls">
      <button
        type="button"
        className="header-icon-button"
        aria-label={label}
        title={label}
        aria-pressed={enabled}
        onClick={() => gameAudio.setEnabled(!gameAudio.enabled)}
      >
        {enabled ? (
          <Volume2 size={20} aria-hidden="true" />
        ) : (
          <VolumeX size={20} aria-hidden="true" />
        )}
      </button>
      {children}
    </header>
  );
}
