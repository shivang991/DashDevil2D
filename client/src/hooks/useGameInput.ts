import { useEffect, useMemo, useRef } from "react";

export interface GameInput {
  isSteeringLeft: () => boolean;
  isSteeringRight: () => boolean;
  isAccelerating: () => boolean;
  popPauseToggle: () => boolean;
  popRestartToggle: () => boolean;
}

const MOVEMENT_KEYS = new Set(["ArrowLeft", "a", "ArrowRight", "d", "ArrowUp", "w"]);
const SWIPE_THRESHOLD = 30; // px
const HOLD_DURATION = 1500; // ms

export function useGameInput() {
  const activeMovementKeyRef = useRef<string | null>(null);
  const pausePendingRef = useRef(false);
  const restartPendingRef = useRef(false);

  // Touch state
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchSteerRef = useRef<"left" | "right" | null>(null);
  const touchAcceleratingRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (MOVEMENT_KEYS.has(e.key)) activeMovementKeyRef.current = e.key;
      if (e.key === " ") pausePendingRef.current = true;
      if (e.key === "Enter") restartPendingRef.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (activeMovementKeyRef.current === e.key) activeMovementKeyRef.current = null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      touchSteerRef.current = null;

      holdTimerRef.current = setTimeout(() => {
        touchAcceleratingRef.current = true;
      }, HOLD_DURATION);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;

      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        // Cancel hold timer once a swipe is detected
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        touchSteerRef.current = dx < 0 ? "left" : "right";
      }
    };

    const handleTouchEnd = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      touchStartRef.current = null;
      touchSteerRef.current = null;
      touchAcceleratingRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const input = useMemo<GameInput>(
    () => ({
      isSteeringLeft: () =>
        activeMovementKeyRef.current === "ArrowLeft" ||
        activeMovementKeyRef.current === "a" ||
        touchSteerRef.current === "left",
      isSteeringRight: () =>
        activeMovementKeyRef.current === "ArrowRight" ||
        activeMovementKeyRef.current === "d" ||
        touchSteerRef.current === "right",
      isAccelerating: () =>
        activeMovementKeyRef.current === "ArrowUp" ||
        activeMovementKeyRef.current === "w" ||
        touchAcceleratingRef.current,
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
