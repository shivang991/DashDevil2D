import type { GameObject, GameStatus } from "./types";

export class GameStateManager {
  // Config (adjustable)
  laneCount = 3;
  maxHealth = 4;
  roadWidthRatio = 0.5; // road takes 60% of canvas width

  // Player
  health = 4;
  score = 0;
  currentLane = 1; // 0-indexed, center lane
  carWidth = 50;
  carHeight = 80;
  carY = 0; // set by reset() based on canvas height

  // Road scrolling
  roadSpeed = 800; // pixels/sec
  roadOffset = 0; // animated dashed lines

  // Spawning
  spawnTimer = 0;
  spawnInterval = 1.0; // seconds between spawns
  minSpawnInterval = 0.35;
  difficultyTimer = 0; // tracks elapsed time for difficulty ramp

  // Game objects
  obstacles: GameObject[] = [];
  coins: GameObject[] = [];

  // Lane switching cooldown (prevents multi-lane jump from held key)
  laneSwitchCooldown = 0;

  // Game status
  status: GameStatus = "playing";

  reset(canvasHeight: number) {
    this.health = this.maxHealth;
    this.score = 0;
    this.currentLane = Math.floor(this.laneCount / 2);
    this.carY = canvasHeight - this.carHeight - 40;
    this.roadSpeed = 400;
    this.roadOffset = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 1.0;
    this.difficultyTimer = 0;
    this.obstacles = [];
    this.coins = [];
    this.laneSwitchCooldown = 0;
    this.status = "playing";
  }

  /** Returns the center X position of a lane given the canvas width. */
  laneX(lane: number, canvasWidth: number): number {
    const roadWidth = canvasWidth * this.roadWidthRatio;
    const roadLeft = (canvasWidth - roadWidth) / 2;
    const laneWidth = roadWidth / this.laneCount;
    return roadLeft + laneWidth * lane + laneWidth / 2;
  }
}
