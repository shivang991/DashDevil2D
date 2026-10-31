import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";
import { GameWorld } from "@/components/GameWorld";
import { MultiplayerScreen } from "@/screens/MultiplayerScreen";
import { AdminScreen } from "@/screens/AdminScreen";
import { MenuScreen } from "@/screens/MenuScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { accountAPI, AccountError, clearReconnectState, type Account } from "@/transport/account";

type Screen = "menu" | "game" | "multiplayer" | "login" | "admin";

function App() {
  const hasStarted = useRef(false);
  const [mode, setMode] = useState<1 | 2>(1);
  const [countdown, setCountdown] = useState<5 | 3>(5);
  const [screen, setScreen] = useState<Screen>("menu");
  const [soundEnabled, setSoundEnabled] = useState(gameAudio.enabled);
  const [account, setAccount] = useState<Account>();
  const channel = useRef<BroadcastChannel | undefined>(undefined);
  const authEpoch = useRef(0);
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      const epoch = ++authEpoch.current;
      try {
        const next = await accountAPI.current();
        if (!disposed && epoch === authEpoch.current) setAccount(next);
      } catch (error) {
        if (
          !disposed &&
          epoch === authEpoch.current &&
          error instanceof AccountError &&
          error.status === 401
        ) {
          setAccount(undefined);
          clearReconnectState();
          setScreen((current) => (current === "multiplayer" ? "menu" : current));
        }
      }
    };
    void refresh();
    const onRefresh = () => void refresh();
    window.addEventListener("focus", onRefresh);
    window.addEventListener("dashdevil-session-expired", onRefresh);
    const interval = setInterval(onRefresh, 60000);
    if (typeof BroadcastChannel === "function") {
      channel.current = new BroadcastChannel("dashdevil-account");
      channel.current.onmessage = onRefresh;
    }
    return () => {
      disposed = true;
      clearInterval(interval);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("dashdevil-session-expired", onRefresh);
      channel.current?.close();
    };
  }, []);
  async function logout() {
    await accountAPI.logout();
    authEpoch.current++;
    clearReconnectState();
    setAccount(undefined);
    setScreen("menu");
    channel.current?.postMessage("changed");
  }

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
      {account?.mustChangePassword || screen === "login" ? (
        <LoginScreen
          key={account?.mustChangePassword ? account.id : "login"}
          account={account}
          onBack={() => setScreen("menu")}
          onLogout={logout}
          onAuthenticated={(next) => {
            authEpoch.current++;
            clearReconnectState();
            setAccount(next);
            setScreen("menu");
            channel.current?.postMessage("changed");
          }}
        />
      ) : screen === "admin" && account?.admin ? (
        <AdminScreen
          onBack={() => setScreen("menu")}
          onAccountSaved={(next) => {
            authEpoch.current++;
            setAccount(next);
            channel.current?.postMessage("changed");
          }}
        />
      ) : screen === "menu" || screen === "admin" ? (
        <MenuScreen
          account={account}
          onLogin={() => setScreen("login")}
          onAdmin={() => setScreen("admin")}
          onLogout={logout}
          onAccountSaved={(next) => {
            authEpoch.current++;
            setAccount(next);
            channel.current?.postMessage("changed");
          }}
          onMultiplayer={(mode) => {
            if (!account || account.mustChangePassword) return;
            setMode(mode);
            setScreen("multiplayer");
          }}
          onStartGame={() => {
            gameAudio.unlock();
            setCountdown(hasStarted.current ? 3 : 5);
            hasStarted.current = true;
            setScreen("game");
          }}
        />
      ) : screen === "multiplayer" ? (
        <MultiplayerScreen
          playerName={account?.username ?? "Guest"}
          mode={mode}
          onBack={() => {
            setSoundEnabled(gameAudio.enabled);
            setScreen("menu");
          }}
        />
      ) : (
        <GameWorld
          countdown={countdown}
          onBack={() => {
            setSoundEnabled(gameAudio.enabled);
            setScreen("menu");
          }}
        />
      )}
      {screen === "menu" && (
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
      )}
    </>
  );
}

export default App;
