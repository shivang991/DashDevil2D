import { gameConfig } from "@/lib/constants";

export interface GameState {
  health: number;
  score: number;
  currentLane: number;
  visualLane: number;
  carY: number;
  carYBase: number;
  roadSpeed: number;
  roadOffset: number;
  grassSeed: number;
  roadWidthRatio: number;
  accelerating: boolean;
  spawnTimer: number;
  spawnInterval: number;
  difficultyTimer: number;
  obstacles: { lane: number; y: number; width: number; height: number }[];
  coins: { lane: number; y: number; width: number; height: number }[];
  laneSwitchCooldown: number;
  invincibleTimer: number;
  blinkTimer: number;
  carVisible: boolean;
  shakeTimer: number;
  shakeOffsetX: number;
  shakeOffsetY: number;
  shakeIntensityMultiplier: number;
  gameOverFadeAlpha: number;
  carTilt: number;
  canvasWidth: number;
  canvasHeight: number;
  status: "countdown" | "playing" | "gameover";
  paused: boolean;
  gameOverAnimDone: boolean;
  countdownTimer: number;
}

export interface GameContext {
  gameState: GameState;
  updateGameState: (partial: Partial<GameState>) => void;
  resetGameState: () => void;
}
import { useMemo, useState } from "react";

function makeInitialState(): GameState {
  const midLane = Math.floor(gameConfig.laneCount / 2);
  return {
    health: gameConfig.maxHealth,
    score: 0,
    currentLane: midLane,
    visualLane: midLane,
    carY: 0,
    carYBase: 0,
    roadSpeed: 400,
    roadOffset: 0,
    grassSeed: Math.floor(Math.random() * 0x100000000),
    roadWidthRatio: 0.6,
    accelerating: false,
    spawnTimer: 0,
    spawnInterval: 1.0,
    difficultyTimer: 0,
    obstacles: [],
    coins: [],
    laneSwitchCooldown: 0,
    invincibleTimer: 0,
    blinkTimer: 0,
    carVisible: true,
    shakeTimer: 0,
    shakeOffsetX: 0,
    shakeOffsetY: 0,
    shakeIntensityMultiplier: 1,
    gameOverFadeAlpha: 0,
    carTilt: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    status: "countdown",
    paused: false,
    gameOverAnimDone: false,
    countdownTimer: 5,
  };
}

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
      setHealth(gameConfig.maxHealth);
      setStatus("countdown");
      setPaused(false);
      setGameOverAnimDone(false);
    };

    return { gameState: _state, updateGameState, resetGameState };
  }, []);

  return context;
}
