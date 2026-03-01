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
  roadSpeed = 800; // pixels/sec, base speed
  roadOffset = 0; // animated dashed lines

  // Accelerate config
  accelSpeedMultiplier = 2; // road speed multiplier when accelerating
  accelCarOffset = 80; // how many pixels the car moves up when accelerating
  accelLerpSpeed = 8; // how fast the car position lerps to target
  accelerating = false; // whether player is currently holding accelerate
  carYBase = 0; // default (non-accelerating) carY, set by reset()

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

  // Smooth lane transition
  visualLane = 1; // float that lerps toward currentLane
  laneLerpSpeed = 10; // higher = snappier

  // Hit effects
  invincibleTimer = 0; // seconds remaining of invincibility
  invincibleDuration = 2.0; // how long invincibility lasts
  blinkTimer = 0; // cycles for blink effect
  blinkCount = 3; // number of blinks during invincibility
  carVisible = true; // toggled by blink effect
  shakeTimer = 0; // seconds remaining of screen shake
  shakeDuration = 0.5; // how long the shake lasts
  shakeIntensity = 20; // max pixel offset for shake
  shakeOffsetX = 0; // current shake offset (computed each frame)
  shakeOffsetY = 0;

  // Canvas dimensions (updated each render frame)
  canvasWidth = 0;

  // Game status
  status: GameStatus = "playing";

  reset(canvasHeight: number) {
    this.health = this.maxHealth;
    this.score = 0;
    this.currentLane = Math.floor(this.laneCount / 2);
    this.carYBase = canvasHeight - this.carHeight - 40;
    this.carY = this.carYBase;
    this.accelerating = false;
    this.roadSpeed = 400;
    this.roadOffset = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 1.0;
    this.difficultyTimer = 0;
    this.obstacles = [];
    this.coins = [];
    this.laneSwitchCooldown = 0;
    this.visualLane = this.currentLane;
    this.invincibleTimer = 0;
    this.blinkTimer = 0;
    this.carVisible = true;
    this.shakeTimer = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
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
