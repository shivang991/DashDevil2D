import type { InputState } from "./types";

export class InputManager implements InputState {
  private _keys = new Set<string>();

  get keys(): ReadonlySet<string> {
    return this._keys;
  }

  isKeyDown(key: string): boolean {
    return this._keys.has(key);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this._keys.add(e.key);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this._keys.delete(e.key);
  };

  simulateKeyDown(key: string) {
    this._keys.add(key);
  }

  simulateKeyUp(key: string) {
    this._keys.delete(key);
  }

  attach(target: Window = window) {
    target.addEventListener("keydown", this.handleKeyDown);
    target.addEventListener("keyup", this.handleKeyUp);
  }

  detach(target: Window = window) {
    target.removeEventListener("keydown", this.handleKeyDown);
    target.removeEventListener("keyup", this.handleKeyUp);
    this._keys.clear();
  }
}
