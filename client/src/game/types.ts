export interface Vector2 {
  x: number;
  y: number;
}

export interface GameState {
  paused: boolean;
}

export type UpdateFn = (dt: number, input: InputState) => void;
export type RenderFn = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

export interface InputState {
  keys: ReadonlySet<string>;
  isKeyDown: (key: string) => boolean;
}
