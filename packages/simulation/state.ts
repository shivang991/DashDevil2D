import { gameConfig, type GameConfig } from "./config";

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
  obstacles: { id?: number; lane: number; y: number; width: number; height: number }[];
  coins: { id?: number; lane: number; y: number; width: number; height: number }[];
  hearts: { id?: number; lane: number; y: number; width: number; height: number }[];
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

export function makeInitialState(random: () => number = Math.random, configuration: GameConfig = gameConfig): GameState {
  const gameConfig = configuration;
  const midLane = Math.floor(gameConfig.laneCount / 2);
  return {
    health: gameConfig.maxHealth,
    score: 0,
    currentLane: midLane,
    visualLane: midLane,
    carY: 0,
    carYBase: 0,
    roadSpeed: gameConfig.startingRoadSpeed,
    roadOffset: 0,
    grassSeed: Math.floor(random() * 0x100000000),
    roadWidthRatio: 0.6,
    accelerating: false,
    spawnTimer: 0,
    spawnInterval: gameConfig.initialSpawnInterval,
    difficultyTimer: 0,
    obstacles: [],
    coins: [],
    hearts: [],
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

