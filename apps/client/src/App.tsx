import { useEffect, useRef, useState } from "react";
import { ChatShell } from "@/components/Chat";
import { Volume2, VolumeX } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";
import { MultiplayerScreen } from "@/screens/MultiplayerScreen";
import { AdminScreen } from "@/screens/AdminScreen";
import { MenuScreen } from "@/screens/MenuScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { accountAPI, AccountError, clearReconnectState, type Account } from "@/transport/account";
import { Navigate, useBlocker, useLocation, useNavigate } from "react-router";
import { GameWorld } from "@/components/GameWorld";
import { NavigationConfirmation } from "@/screens/NavigationConfirmation";
import { ModeDragRace, ModeRoadRage } from "@dashdevil/contracts/protocol";
import { multiplayerPath } from "@/lib/uiUtils";
import type { MultiplayerMode } from "@/transport/PairedConnection";

function SoloRoute(props: { countdown: 5 | 3; onBack: () => void }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname,
  );
  return (
    <>
      <GameWorld {...props} />
      <NavigationConfirmation blocker={blocker} />
    </>
  );
}

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
  const screen =
    pathname === "/"
      ? "menu"
      : pathname === "/long-drive"
        ? "game"
        : pathname === "/login"
          ? "login"
          : pathname === "/admin"
            ? "admin"
            : "multiplayer";
  const mode = pathname === "/multiplayer/road-rage" ? ModeRoadRage : ModeDragRace;
  const [countdown, setCountdown] = useState<5 | 3>(5);
  const [authLoaded, setAuthLoaded] = useState(false);
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
        }
      } finally {
        if (!disposed && epoch === authEpoch.current) setAuthLoaded(true);
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
    void navigate("/", { flushSync: true });
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

  useEffect(() => {
    if (authLoaded && !account && screen === "multiplayer")
      void navigate("/", { replace: true, flushSync: true });
  }, [authLoaded, account, screen, navigate]);

  if (
    ![
      "/",
      "/login",
      "/admin",
      "/long-drive",
      "/multiplayer/drag-race",
      "/multiplayer/road-rage",
    ].includes(pathname)
  )
    return <Navigate to="/" replace />;

  const back = () => {
    void navigate("/", { flushSync: true });
  };
  const selectMode = (mode: MultiplayerMode) => {
    void navigate(multiplayerPath(mode), { flushSync: true });
  };

  if (screen === "multiplayer" && !authLoaded) return null;

  return (
    <ChatShell key={account?.id ?? "guest"} account={account}>
      {account?.mustChangePassword ||
      screen === "login" ||
      (screen === "multiplayer" && !account) ? (
        <LoginScreen
          key={account?.mustChangePassword ? account.id : "login"}
          account={account}
          onBack={() => void navigate("/", { flushSync: true })}
          onLogout={logout}
          onAuthenticated={(next) => {
            authEpoch.current++;
            clearReconnectState();
            setAccount(next);
            void navigate("/", { flushSync: true });
            channel.current?.postMessage("changed");
          }}
        />
      ) : screen === "admin" && account?.admin ? (
        <AdminScreen
          onBack={() => void navigate("/", { flushSync: true })}
          onAccountSaved={(next) => {
            authEpoch.current++;
            setAccount(next);
            channel.current?.postMessage("changed");
          }}
        />
      ) : screen === "menu" || screen === "admin" ? (
        <MenuScreen
          account={account}
          onLogin={() => void navigate("/login", { flushSync: true })}
          onAdmin={() => void navigate("/admin", { flushSync: true })}
          onLogout={logout}
          onAccountSaved={(next) => {
            authEpoch.current++;
            setAccount(next);
            channel.current?.postMessage("changed");
          }}
          onMultiplayer={(mode) => {
            if (!account || account.mustChangePassword) return;
            selectMode(mode);
          }}
          onStartGame={() => {
            gameAudio.unlock();
            setCountdown(hasStarted.current ? 3 : 5);
            hasStarted.current = true;
            void navigate("/long-drive", { flushSync: true });
          }}
        />
      ) : screen === "multiplayer" ? (
        <MultiplayerScreen playerName={account?.username ?? "Guest"} mode={mode} onBack={back} />
      ) : (
        <SoloRoute countdown={countdown} onBack={back} />
      )}
      {screen === "menu" && <MenuSoundButton />}
    </ChatShell>
  );
}

export default App;
