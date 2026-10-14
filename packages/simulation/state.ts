import { gameConfig, type GameConfig } from "./config";

import { createTrack, type Track } from "./track";

export interface RoadObject { id?: number; lane: number; y: number; width: number; height: number; distance?: number }

export interface GameState {
  track: Track;
  carOffset: number;
  carWorldX: number;
  carWorldDistance: number;
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
  obstacles: RoadObject[];
  coins: RoadObject[];
  hearts: RoadObject[];
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
    track: createTrack(1),
    carOffset: 0,
    carWorldX: 0,
    carWorldDistance: 0,
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

