import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { RaceView } from "../../src/components/RaceView";
import { captureConfiguration } from "@dashdevil/simulation/config";
import { configurationContext } from "@dashdevil/contracts/validation";
import type { PairedState } from "../../src/transport/PairedConnection";

test("multiplayer shares touch and keyboard holds and releases controls when settings open", () => {
  const connection = {
    frame: () => undefined,
    input: vi.fn(),
    releaseControls: vi.fn(),
    recordDraw: vi.fn(),
    recordResultCommit: vi.fn(),
  };
  const state = {
    status: "Connected",
    context: configurationContext(captureConfiguration("drag-race")),
  } as PairedState;
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const pointer = (button: HTMLButtonElement, type: string, id: number) => {
    button.setPointerCapture = vi.fn();
    act(() =>
      button.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
          pointerId: id,
          button: 0,
        }),
      ),
    );
  };
  try {
    act(() =>
      root.render(
        createElement(RaceView, { connection, state, suspended: false, onLeave: vi.fn() }),
      ),
    );
    const gas = host.querySelector<HTMLButtonElement>('[aria-label="Accelerate"]')!;
    const left = host.querySelector<HTMLButtonElement>('[aria-label="Steer left"]')!;
    const canvas = host.querySelector("canvas")!;
    expect(document.activeElement).toBe(canvas);
    expect(host.textContent).not.toContain("W / ↑");
    act(() => canvas.blur());
    const key = (target: EventTarget, type: string, value = "w", code = "KeyW") =>
      act(() => target.dispatchEvent(new KeyboardEvent(type, { key: value, code, bubbles: true })));
    key(document.body, "keydown");
    expect(connection.input).toHaveBeenLastCalledWith(0, 3);
    key(document.body, "keyup");
    expect(connection.input).toHaveBeenLastCalledWith(1, 3);
    const input = document.createElement("input");
    host.append(input);
    connection.input.mockClear();
    input.focus();
    key(input, "keydown");
    key(input, "keyup");
    expect(connection.input).not.toHaveBeenCalled();
    input.remove();
    act(() => canvas.focus());
    pointer(left, "pointerdown", 1);
    pointer(gas, "pointerdown", 2);
    expect(connection.input.mock.calls).toEqual([
      [0, 1],
      [0, 3],
    ]);
    act(() =>
      canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "w", code: "KeyW", bubbles: true })),
    );
    pointer(gas, "pointerup", 2);
    expect(connection.input.mock.calls).toHaveLength(2);
    act(() =>
      canvas.dispatchEvent(new KeyboardEvent("keyup", { key: "w", code: "KeyW", bubbles: true })),
    );
    expect(connection.input).toHaveBeenLastCalledWith(1, 3);
    pointer(left, "pointercancel", 1);
    expect(connection.input).toHaveBeenLastCalledWith(1, 1);
    // Preserve the existing canvas-blur asymmetry: driving resets, touch visuals do not.
    pointer(gas, "pointerdown", 4);
    act(() => canvas.blur());
    expect(gas.getAttribute("aria-pressed")).toBe("true");
    connection.input.mockClear();
    pointer(gas, "lostpointercapture", 4);
    expect(gas.getAttribute("aria-pressed")).toBe("false");
    expect(connection.input).not.toHaveBeenCalled();
    pointer(gas, "pointerdown", 3);
    connection.releaseControls.mockClear();
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Settings"]')!.click());
    expect(connection.releaseControls).toHaveBeenCalled();
    expect(gas.disabled).toBe(true);
    expect(gas.getAttribute("aria-pressed")).toBe("false");
    expect(host.querySelector('[aria-label="Race menu"]')).not.toBeNull();
    connection.input.mockClear();
    key(document.body, "keydown", "ArrowLeft", "ArrowLeft");
    key(document.body, "keyup", "ArrowLeft", "ArrowLeft");
    expect(connection.input).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});

test("race lifecycle resets input, suppresses keyboard repeats, and switches connection ownership", () => {
  const makeConnection = () => ({
    frame: () => undefined,
    input: vi.fn(),
    releaseControls: vi.fn(),
    recordDraw: vi.fn(),
    recordResultCommit: vi.fn(),
  });
  let connection = makeConnection();
  let state = {
    status: "Connected",
    roundId: 1,
    context: configurationContext(captureConfiguration("drag-race")),
  } as PairedState;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = (suspended = false) =>
    act(() =>
      root.render(createElement(RaceView, { connection, state, suspended, onLeave: vi.fn() })),
    );
  const down = (repeat = false) =>
    act(() =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "w", code: "KeyW", bubbles: true, repeat }),
      ),
    );
  try {
    render();
    down();
    down();
    down(true);
    expect(connection.input.mock.calls).toEqual([[0, 3]]);
    connection.input.mockClear();
    connection.releaseControls.mockClear();
    state = { ...state, roundId: 2 };
    render();
    expect(connection.releaseControls).toHaveBeenCalled();
    down(true);
    expect(connection.input).not.toHaveBeenCalled();
    down();
    expect(connection.input.mock.calls).toEqual([[0, 3]]);
    render(true);
    connection.input.mockClear();
    down();
    expect(connection.input).not.toHaveBeenCalled();
    render();
    expect(connection.input).not.toHaveBeenCalled();
    down();
    expect(connection.input.mock.calls).toEqual([[0, 3]]);
    const previous = connection;
    previous.releaseControls.mockClear();
    connection = makeConnection();
    render();
    expect(previous.releaseControls).toHaveBeenCalled();
    previous.input.mockClear();
    down();
    expect(connection.input.mock.calls).toEqual([[0, 3]]);
    expect(previous.input).not.toHaveBeenCalled();
    for (const [target, event] of [
      [window, "blur"],
      [document, "visibilitychange"],
    ] as const) {
      connection.releaseControls.mockClear();
      act(() => target.dispatchEvent(new Event(event)));
      expect(connection.releaseControls).toHaveBeenCalled();
      connection.input.mockClear();
      down(true);
      expect(connection.input).not.toHaveBeenCalled();
      down();
      expect(connection.input.mock.calls).toEqual([[0, 3]]);
    }
    connection.releaseControls.mockClear();
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
  expect(connection.releaseControls).toHaveBeenCalled();
});
