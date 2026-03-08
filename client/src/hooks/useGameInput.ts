import { useEffect, useMemo, useRef } from "react";

export interface GameInput {
  isSteeringLeft: () => boolean;
  isSteeringRight: () => boolean;
  isAccelerating: () => boolean;
  popPauseToggle: () => boolean;
  popRestartToggle: () => boolean;
}

export function useGameInput() {
  const keysRef = useRef(new Set<string>());
  const pausePendingRef = useRef(false);
  const restartPendingRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === " ") pausePendingRef.current = true;
      if (e.key === "Enter") restartPendingRef.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const input = useMemo<GameInput>(
    () => ({
      isSteeringLeft: () =>
        keysRef.current.has("ArrowLeft") || keysRef.current.has("a"),
      isSteeringRight: () =>
        keysRef.current.has("ArrowRight") || keysRef.current.has("d"),
      isAccelerating: () =>
        keysRef.current.has("ArrowUp") || keysRef.current.has("w"),
      popPauseToggle: () => {
        const val = pausePendingRef.current;
        pausePendingRef.current = false;
        return val;
      },
      popRestartToggle: () => {
        const val = restartPendingRef.current;
        restartPendingRef.current = false;
        return val;
      },
    }),
    [],
  );

  return input;
}
