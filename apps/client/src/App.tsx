import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";
import { MultiplayerScreen } from "@/screens/MultiplayerScreen";
import { MenuScreen } from "@/screens/MenuScreen";
import { Navigate, useLocation, useNavigate } from "react-router";
import { SoloRoute } from "@/screens/SoloRoute";
import { ModeDragRace, ModeRoadRage } from "@dashdevil/contracts/protocol";
import { multiplayerPath } from "@/screens/multiplayerRoute";
import type { MultiplayerMode } from "@/transport/PairedConnection";

function MenuSoundButton() {
  const [soundEnabled, setSoundEnabled] = useState(gameAudio.enabled);
  return (
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
      {soundEnabled ? (
        <Volume2 size={18} aria-hidden="true" />
      ) : (
        <VolumeX size={18} aria-hidden="true" />
      )}
      Sound {soundEnabled ? "on" : "off"}
    </button>
  );
}

function App() {
  const hasStarted = useRef(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const screen = pathname === "/" ? "menu" : pathname === "/long-drive" ? "game" : "multiplayer";
  const mode = pathname === "/multiplayer/road-rage" ? ModeRoadRage : ModeDragRace;
  const [countdown, setCountdown] = useState<5 | 3>(5);

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

  if (!["/", "/long-drive", "/multiplayer/drag-race", "/multiplayer/road-rage"].includes(pathname))
    return <Navigate to="/" replace />;

  const back = () => {
    void navigate("/", { flushSync: true });
  };
  const selectMode = (mode: MultiplayerMode) => {
    void navigate(multiplayerPath(mode), { flushSync: true });
  };

  return (
    <>
      {screen === "menu" ? (
        <MenuScreen
          onMultiplayer={selectMode}
          onStartGame={() => {
            gameAudio.unlock();
            setCountdown(hasStarted.current ? 3 : 5);
            hasStarted.current = true;
            void navigate("/long-drive", { flushSync: true });
          }}
        />
      ) : screen === "multiplayer" ? (
        <MultiplayerScreen mode={mode} onBack={back} />
      ) : (
        <SoloRoute countdown={countdown} onBack={back} />
      )}
      {screen === "menu" && <MenuSoundButton />}
    </>
  );
}

export default App;
