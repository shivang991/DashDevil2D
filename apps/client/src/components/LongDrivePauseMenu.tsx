import { useState } from "react";
import { Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";
import { Button } from "./ui/button";

export function LongDrivePauseMenu({
  onResume,
  onRestart,
}: {
  onResume: () => void;
  onRestart: () => void;
}) {
  const [sound, setSound] = useState(gameAudio.enabled);
  const SoundIcon = sound ? Volume2 : VolumeX;
  return (
    <div
      id="long-drive-pause"
      role="region"
      aria-label="Game paused"
      className="game-overlay absolute inset-0 flex overflow-auto bg-black/65 p-3"
    >
      <div className="m-auto flex w-36 shrink-0 flex-col gap-2">
        <Button
          className="min-h-11 bg-red-400 text-neutral-950 hover:bg-red-300"
          onClick={onResume}
        >
          <Play aria-hidden="true" />
          Resume
        </Button>
        <Button variant="multiplayer" className="min-h-11" onClick={onRestart}>
          <RotateCcw aria-hidden="true" />
          Restart
        </Button>
        <Button
          variant="multiplayer"
          className="min-h-11"
          aria-label={sound ? "Mute sound" : "Enable sound"}
          aria-pressed={sound}
          onClick={() => {
            gameAudio.setEnabled(!gameAudio.enabled);
            setSound(gameAudio.enabled);
          }}
        >
          <SoundIcon aria-hidden="true" />
          Sound {sound ? "on" : "off"}
        </Button>
      </div>
    </div>
  );
}
