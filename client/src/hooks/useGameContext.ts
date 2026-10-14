
import { makeInitialState, type GameState } from "../../../packages/simulation/state";
export type { GameState } from "../../../packages/simulation/state";

export interface GameContext {
  gameState: GameState;
  updateGameState: (partial: Partial<GameState>) => void;
  resetGameState: () => void;
}
import { useMemo, useState } from "react";

const _state: GameState = makeInitialState();

export function useGameContext(): GameContext {
  const [, setScore] = useState(_state.score);
  const [, setHealth] = useState(_state.health);
  const [, setStatus] = useState<"countdown" | "playing" | "gameover">(
    _state.status,
  );
  const [, setPaused] = useState(_state.paused);
  const [, setGameOverAnimDone] = useState(_state.gameOverAnimDone);
  const [, setCountdownDisplay] = useState(Math.ceil(_state.countdownTimer));

  const context = useMemo(() => {
    const updateGameState = (partial: Partial<GameState>) => {
      Object.assign(_state, partial);
      if (typeof partial.health === "number") setHealth(partial.health);
      if (typeof partial.status === "string") setStatus(partial.status);
      if (typeof partial.score === "number") setScore(partial.score);
      if (typeof partial.paused === "boolean") setPaused(partial.paused);
      if (typeof partial.gameOverAnimDone === "boolean")
        setGameOverAnimDone(partial.gameOverAnimDone);
      if (typeof partial.countdownTimer === "number")
        setCountdownDisplay(partial.countdownTimer);
    };

    const resetGameState = () => {
      const next = makeInitialState();

      // Properties related to canvas sizing need to be carried over
      next.carYBase = _state.carYBase;
      next.canvasWidth = _state.canvasWidth;
      next.canvasHeight = _state.canvasHeight;
      next.roadWidthRatio = _state.roadWidthRatio;
      next.carYBase = _state.carYBase;
      next.carY = next.carYBase;
      next.status = "countdown";
      next.countdownTimer = 3;
      Object.assign(_state, next);

      setScore(0);
      setHealth(next.health);
      setStatus("countdown");
      setPaused(false);
      setGameOverAnimDone(false);
    };

    return { gameState: _state, updateGameState, resetGameState };
  }, []);

  return context;
}
