import { useEffect, useRef, useState } from "react";
import type { ConfigurationOverrides } from "@dashdevil/simulation/config";
import { GameWorldView } from "./GameWorldView";
import { LongDriveSession, type UISnapshot } from "../game/long-drive/LongDriveSession";

interface GameWorldProps {
  countdown: 5 | 3;
  seed?: number;
  /** Developer/test overrides captured by the session; no player tuning controls. */
  configuration?: ConfigurationOverrides | (() => ConfigurationOverrides);
  onBack?: () => void;
}

export function GameWorld({ onBack, countdown, configuration, seed }: GameWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<LongDriveSession | null>(null);
  const [ui, setUi] = useState<UISnapshot>({
    health: 2,
    maxHealth: 2,
    score: 0,
    status: "countdown",
    paused: false,
    gameOverAnimDone: false,
    countdown,
    accelerating: false,
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const session = new LongDriveSession({
      mode: "long-drive",
      canvas,
      countdown,
      configuration,
      seed,
    });
    sessionRef.current = session;
    setUi(session.getSnapshot());
    const unsubscribe = session.subscribe(() => setUi(session.getSnapshot()));
    session.start();
    return () => {
      unsubscribe();
      session.dispose();
      sessionRef.current = null;
    };
  }, [countdown, configuration, seed]);

  return (
    <GameWorldView
      ui={ui}
      canvasRef={canvasRef}
      onFocus={() => sessionRef.current?.focus()}
      onControl={(control, down) => sessionRef.current?.control(control, down)}
      onCommand={(command) => sessionRef.current?.command(command)}
      onBack={onBack}
    />
  );
}
