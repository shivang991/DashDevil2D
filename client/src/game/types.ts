export interface Vector2 {
  x: number;
  y: number;
}

export interface GameObject {
  lane: number;
  y: number;
  width: number;
  height: number;
}

export type GameStatus = "playing" | "gameover";

export type UpdateFn = (dt: number, input: InputState) => void;
export type RenderFn = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

export interface InputState {
  keys: ReadonlySet<string>;
  isKeyDown: (key: string) => boolean;
}
