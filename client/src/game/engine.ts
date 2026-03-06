import type { UpdateFn, RenderFn } from "./types";
import { InputManager } from "./input";

export class GameEngine {
  private animationId: number | null = null;
  private lastTime = 0;
  private _paused = false;
  private canvas: HTMLCanvasElement;
  private updateFn: UpdateFn;
  private renderFn: RenderFn;

  readonly input = new InputManager();

  constructor(canvas: HTMLCanvasElement, update: UpdateFn, render: RenderFn) {
    this.canvas = canvas;
    this.updateFn = update;
    this.renderFn = render;
  }

  get paused() {
    return this._paused;
  }

  start() {
    this.input.attachListener();
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.input.detachListener();
  }

  togglePause() {
    this._paused = !this._paused;
  }

  private loop = (now: number) => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = now;

    if (!this._paused) {
      this.updateFn(dt, this.input);
    }

    const ctx = this.canvas.getContext("2d");
    if (ctx) {
      this.renderFn(ctx, this.canvas.width, this.canvas.height);
    }

    this.animationId = requestAnimationFrame(this.loop);
  };
}
