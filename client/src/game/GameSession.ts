import { advanceLongDrive, createLongDrive, resetLongDrive } from '../../../packages/simulation/longDrive';
import { type GameState } from '../../../packages/simulation/state';
import { gameConfig } from '../lib/constants';
import { GameAudio } from '../lib/gameAudio';
import { KeyboardInput } from './KeyboardInput';
import { renderLongDrive } from '../lib/gameRenderer';

export interface FrameClock {
  now(): number;
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}
const browserClock: FrameClock = {
  now: () => performance.now(),
  request: callback => requestAnimationFrame(callback),
  cancel: id => cancelAnimationFrame(id),
};
export interface SessionOptions {
  mode: 'long-drive';
  canvas: HTMLCanvasElement;
  countdown: 5 | 3;
  clock?: FrameClock;
  random?: () => number;
}
export interface UISnapshot {
  readonly health: number; readonly score: number;
  readonly status: GameState['status']; readonly paused: boolean;
  readonly gameOverAnimDone: boolean; readonly countdown: number; readonly accelerating: boolean;
}
export class GameSession {
  private readonly game;
  private readonly clock;
  private readonly audio = new GameAudio();
  private readonly listeners = new Set<() => void>();
  private snapshot: UISnapshot;
  private frame?: number;
  private lastTime = 0;
  private disposed = false;
  private readonly input: KeyboardInput;
  private focused = true;

  private readonly options: SessionOptions;
  constructor(options: SessionOptions) {
    this.options = options;
    this.clock = options.clock ?? browserClock;
    this.game = createLongDrive(options.random);
    this.game.state.countdownTimer = options.countdown;
    options.canvas.tabIndex = 0;
    this.input = new KeyboardInput(options.canvas, () => ({ status: this.game.state.status, paused: this.game.state.paused, restartable: this.game.state.gameOverAnimDone, suspended: this.suspended() }), command => this.command(command));
    this.resize();
    this.snapshot = this.uiSnapshot();
    window.addEventListener('resize', this.resize);
    window.addEventListener('blur', this.blur); window.addEventListener('focus', this.focusReturned);
    document.addEventListener('visibilitychange', this.visibility);
  }
  getSnapshot = (): UISnapshot => this.snapshot;
  getPresentation = (): Readonly<GameState> => Object.freeze({ ...this.game.state,
    coins: this.game.state.coins.map(object => Object.freeze({ ...object })),
    obstacles: this.game.state.obstacles.map(object => Object.freeze({ ...object })),
  });
  subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  start(): void {
    if (this.disposed || this.frame !== undefined) return;
    this.lastTime = this.clock.now();
    this.options.canvas.focus({ preventScroll: true });
    this.frame = this.clock.request(this.tick);
  }
  command(command: 'pause' | 'restart' | 'reset'): void {
    if (this.disposed) return;
    const state = this.game.state;
    if (command === 'pause' && state.status === 'playing') {
      this.lastTime = Math.max(this.lastTime, this.clock.now());
      this.input.clear();
      state.accelerating = false;
      this.audio.update(state, advanceLongDrive(this.game, 0, { pause: true }));
    } else if (command === 'reset' || (command === 'restart' && state.status === 'gameover' && state.gameOverAnimDone)) {
      this.lastTime = Math.max(this.lastTime, this.clock.now());
      resetLongDrive(this.game);
      this.input.clear();
      this.audio.update(state, advanceLongDrive(this.game, 0, {}));
    }
    this.publish();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== undefined) this.clock.cancel(this.frame);
    this.frame = undefined;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('blur', this.blur); window.removeEventListener('focus', this.focusReturned);
    document.removeEventListener('visibilitychange', this.visibility);
    this.listeners.clear(); this.input.clear();
    this.input.dispose();
    this.audio.dispose();
  }
  private readonly resize = () => {
    if (this.disposed) return;
    const canvas = this.options.canvas;
    canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
    const state = this.game.state;
    const base = canvas.height - gameConfig.carHeight - gameConfig.carBottomMargin;
    const displacement = state.carYBase === 0 ? 0 : state.carY - state.carYBase;
    Object.assign(state, { canvasWidth: canvas.width, canvasHeight: canvas.height,
      roadWidthRatio: canvas.width <= gameConfig.narrowScreenWidth ? gameConfig.roadWidthRatioNarrow : gameConfig.roadWidthRatioNormal,
      carYBase: base, carY: base + displacement });
  };
  private readonly tick = (now: number) => {
    if (this.disposed) return;
    const dt = Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = Math.max(this.lastTime, now);
    this.audio.unlock();
    const previousStatus = this.game.state.status;
    const events = advanceLongDrive(this.game, this.suspended() ? 0 : dt, this.input.read());
    if (this.game.state.status !== previousStatus) this.input.clear();
    this.audio.update(this.game.state, events);
    this.publish();
    if (this.disposed) return;
    const canvas = this.options.canvas;
    const ctx = canvas.getContext('2d');
    if (ctx) renderLongDrive(ctx, canvas.width, canvas.height, this.getPresentation());
    this.frame = this.clock.request(this.tick);
  };
  focus(): void { if (!this.disposed) this.options.canvas.focus({ preventScroll: true }); }
  private suspended(): boolean { return !this.focused || document.hidden; }
  private suspend(): void {
    this.input.clear();
    this.game.state.accelerating = false;
    if (this.game.state.status === 'playing' && !this.game.state.paused) this.command('pause');
    this.audio.syncVisibility(); this.publish();
  }
  private readonly blur = () => { this.focused = false; this.suspend(); };
  private readonly focusReturned = () => { this.focused = true; this.lastTime = this.clock.now(); };
  private readonly visibility = () => { if (document.hidden) this.suspend(); else { this.lastTime = this.clock.now(); this.audio.syncVisibility(); } };
  private uiSnapshot(): UISnapshot {
    const state = this.game.state;
    return Object.freeze({ health: state.health, score: state.score, status: state.status, paused: state.paused,
      gameOverAnimDone: state.gameOverAnimDone, countdown: Math.max(0, Math.ceil(state.countdownTimer - 1e-9)), accelerating: state.accelerating });
  }
  private publish(): void {
    const snapshot = this.uiSnapshot();
    if ((Object.keys(snapshot) as (keyof UISnapshot)[]).every(key => snapshot[key] === this.snapshot[key])) return;
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
