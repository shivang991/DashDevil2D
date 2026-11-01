import {
  type Control,
  ControlLeft,
  ControlRight,
  ControlNOS,
  ControlNone,
  InputIntentPress,
  InputIntentRelease,
} from "@dashdevil/contracts/protocol";
export type DrivingControl = Exclude<Control, typeof ControlNone>;

export interface DrivingInputContext {
  menu: boolean;
  suspended: boolean;
  status: string;
  outcome?: object;
  roundId?: number;
}

const controls: Record<string, DrivingControl> = {
  ArrowLeft: ControlLeft,
  a: ControlLeft,
  A: ControlLeft,
  ArrowRight: ControlRight,
  d: ControlRight,
  D: ControlRight,
  ArrowUp: ControlNOS,
  w: ControlNOS,
  W: ControlNOS,
};
const controlFor = (key: string) => controls[key];
const interactive = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      'button,input,select,textarea,a,[contenteditable]:not([contenteditable="false"])',
    ),
  );

/** Owns multiplayer input sources and their browser lifetime; wire admission stays outside. */
export class MultiplayerDrivingInput {
  private readonly sources = new Map<string, DrivingControl>();
  private context?: DrivingInputContext;
  private readonly output: {
    input: (
      intent: typeof InputIntentPress | typeof InputIntentRelease,
      control: DrivingControl,
    ) => void;
    releaseControls: () => void;
  };
  private readonly pressed = new Set<string>();
  private detach?: () => void;

  constructor(output: MultiplayerDrivingInput["output"]) {
    this.output = output;
  }

  attach(surface: HTMLElement, shortcuts: { menu: () => void; mute: () => void }): () => void {
    this.dispose();
    const release = () => this.reset();
    const down = (event: KeyboardEvent) => {
      if (event.repeat || this.pressed.has(event.code)) return;
      this.pressed.add(event.code);
      if (this.context?.suspended || this.context?.outcome) return;
      if (
        (event.key === "Escape" && (this.context?.menu || !interactive(event.target))) ||
        (event.code === "Space" && !interactive(event.target))
      ) {
        event.preventDefault();
        this.reset();
        shortcuts.menu();
        return;
      }
      if (event.key.toLowerCase() === "m" && !interactive(event.target)) {
        shortcuts.mute();
        return;
      }
      const control = controlFor(event.key);
      if (control && !interactive(event.target) && document.hasFocus() && !document.hidden) {
        if (this.press(`key:${event.code}`, control)) event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => {
      this.pressed.delete(event.code);
      if (this.context?.suspended) return;
      const control = controlFor(event.key);
      if (control && this.release(`key:${event.code}`)) {
        if (!interactive(event.target)) event.preventDefault();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    surface.addEventListener("blur", release);
    const detach = () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
      surface.removeEventListener("blur", release);
      this.reset();
      if (this.detach === detach) this.detach = undefined;
    };
    this.detach = detach;
    return detach;
  }

  dispose(): void {
    this.detach?.();
  }

  update(context: DrivingInputContext): void {
    const previous = this.context;
    this.context = { ...context };
    if (
      !previous ||
      previous.menu !== context.menu ||
      previous.suspended !== context.suspended ||
      previous.status !== context.status ||
      previous.outcome !== context.outcome ||
      previous.roundId !== context.roundId
    )
      this.reset();
  }

  // A source identifies one physical key or one touch control for its lifetime.
  press(source: string, control: DrivingControl): boolean {
    const context = this.context;
    if (
      !context ||
      context.menu ||
      context.suspended ||
      context.outcome ||
      context.status !== "Connected"
    )
      return false;
    const held = [...this.sources.values()].includes(control);
    this.sources.set(source, control);
    // Record the source even if the connection rejects delivery, preserving admission behavior.
    if (!held) this.output.input(InputIntentPress, control);
    return true;
  }

  release(source: string): boolean {
    const control = this.sources.get(source);
    if (!control) return false;
    this.sources.delete(source);
    if (![...this.sources.values()].includes(control))
      this.output.input(InputIntentRelease, control);
    return true;
  }

  reset(): void {
    this.sources.clear();
    this.pressed.clear();
    this.output.releaseControls();
  }
}
