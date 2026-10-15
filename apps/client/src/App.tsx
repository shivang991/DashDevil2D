import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";
import { GameWorld } from "@/components/GameWorld";
import { MenuScreen } from "@/screens/MenuScreen";

type Screen = "menu" | "game";

function App() {
  const hasStarted = useRef(false);
  const [countdown, setCountdown] = useState<5 | 3>(5);
  const [screen, setScreen] = useState<Screen>("menu");
  const [soundEnabled, setSoundEnabled] = useState(gameAudio.enabled);

  useEffect(() => {
    window.addEventListener("pointerdown", gameAudio.unlock);
    window.addEventListener("keydown", gameAudio.unlock);
    document.addEventListener("visibilitychange", gameAudio.syncVisibility);
    return () => {
      window.removeEventListener("pointerdown", gameAudio.unlock);
      window.removeEventListener("keydown", gameAudio.unlock);
      document.removeEventListener("visibilitychange", gameAudio.syncVisibility);
    };
  }, []);

  return (
    <>
      {screen === "menu" ? (
        <MenuScreen onStartGame={() => { gameAudio.unlock(); setCountdown(hasStarted.current ? 3 : 5); hasStarted.current = true; setScreen("game"); }} />
      ) : (
        <GameWorld countdown={countdown} onBack={() => setScreen("menu")} />
      )}
      <button
        type="button"
        aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
        aria-pressed={soundEnabled}
        onClick={() => {
          const enabled = !soundEnabled;
          gameAudio.setEnabled(enabled);
          setSoundEnabled(enabled);
        }}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-neutral-600 bg-neutral-950/90 px-3 py-2 text-xs text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-white"
      >
        {soundEnabled ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
        Sound {soundEnabled ? "on" : "off"}
      </button>
    </>
  );
}

export default App;
