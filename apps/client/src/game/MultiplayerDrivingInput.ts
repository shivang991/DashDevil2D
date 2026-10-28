export type DrivingControl = 1 | 2 | 3;

export interface DrivingInputContext {
  menu: boolean;
  suspended: boolean;
  status: string;
  outcome?: object;
  roundId?: number;
}

/** Shared holds for multiplayer; browser mechanics and wire admission stay outside. */
export class MultiplayerDrivingInput {
  private readonly sources = new Map<string, DrivingControl>();
  private context?: DrivingInputContext;
  private readonly output: {
    input: (intent: 0 | 1, control: DrivingControl) => void;
    releaseControls: () => void;
  };
  private readonly clearKeys: () => void;

  constructor(output: MultiplayerDrivingInput["output"], clearKeys: () => void) {
    this.output = output;
    this.clearKeys = clearKeys;
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
    if (!held) this.output.input(0, control);
    return true;
  }

  release(source: string): boolean {
    const control = this.sources.get(source);
    if (!control) return false;
    this.sources.delete(source);
    if (![...this.sources.values()].includes(control)) this.output.input(1, control);
    return true;
  }

  reset(): void {
    this.sources.clear();
    this.clearKeys();
    this.output.releaseControls();
  }
}
