import type { LongDriveInput } from '../../../packages/simulation/longDrive';

export interface InputAvailability {
  status: 'countdown' | 'playing' | 'gameover'; paused: boolean; restartable: boolean; suspended?: boolean;
}
const movements = new Map<string, 'left' | 'right' | 'accelerate'>([['ArrowLeft', 'left'], ['a', 'left'], ['ArrowRight', 'right'], ['d', 'right'], ['ArrowUp', 'accelerate'], ['w', 'accelerate']] as const);
const interactive = 'button,input,textarea,select,a[href],[contenteditable]:not([contenteditable="false"]),[role="button"]';
export class KeyboardInput {
  private active?: string;
  private disposed = false;
  private readonly surface: HTMLElement;
  private readonly availability: () => InputAvailability;
  private readonly command: (command: 'pause' | 'restart') => void;
  constructor(surface: HTMLElement, availability: () => InputAvailability,
    command: (command: 'pause' | 'restart') => void) {
    this.surface = surface; this.availability = availability; this.command = command;
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.visibility);
    document.addEventListener('focusin', this.focusIn);
  }
  read(): LongDriveInput {
    if (this.disposed || !this.eligibleMovement()) return {};
    const movement = this.active ? movements.get(this.active) : undefined;
    return movement === 'accelerate' ? { accelerating: true } : movement ? { steering: movement } : {};
  }
  clear = (): void => {
    this.active = undefined;
  };
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.visibility); document.removeEventListener('focusin', this.focusIn);
    this.active = undefined;
  }
  private focused(): boolean { return document.activeElement === this.surface; }
  private eligibleMovement(): boolean {
    const available = this.availability();
    return this.focused() && !available.suspended && available.status === 'playing' && !available.paused;
  }
  private readonly keyDown = (event: KeyboardEvent) => {
    const key = event.key;
    const movement = movements.get(key);
    if (!movement && key !== ' ' && key !== 'Enter') return;
    const available = this.availability();
    const nativeTarget = event.target instanceof Element && event.target.closest(interactive);
    const focused = this.focused() && !nativeTarget && !available.suspended;
    const usable = focused && (movement ? available.status === 'playing' && !available.paused : key === ' ' ? available.status === 'playing' : available.status === 'gameover' && available.restartable);
    if (usable) event.preventDefault();
    // The browser marks held-key repeats even when keyup happened elsewhere.
    // A nonrepeat keydown is fresh and must recover after an undelivered keyup.
    if (!usable || event.repeat) return;
    if (movement) this.active = key;
    else this.command(key === ' ' ? 'pause' : 'restart');
  };
  private readonly keyUp = (event: KeyboardEvent) => {
    if (this.active === event.key) this.active = undefined;
  };
  private readonly visibility = () => { if (document.hidden) this.clear(); };
  private readonly focusIn = () => { if (!this.focused()) this.clear(); };
}
