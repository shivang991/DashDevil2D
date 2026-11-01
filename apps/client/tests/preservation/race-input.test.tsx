import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { RaceView } from "@/components/RaceView";
import { playingFixture } from "@/stories/playingFixture";

test("mounted race combines keyboard/touch, ignores repeats, and requires fresh input after interruption", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const { state } = playingFixture(1);
  const connection = {
    frame: vi.fn(),
    input: vi.fn(),
    releaseControls: vi.fn(),
    recordDraw: vi.fn(),
    recordResultCommit: vi.fn(),
  };
  const audio = { enabled: true, setEnabled: vi.fn() };
  const render = (suspended = false) =>
    act(() =>
      root.render(
        <RaceView
          state={state}
          connection={connection}
          suspended={suspended}
          onLeave={vi.fn()}
          audio={audio}
        />,
      ),
    );
  const key = (key: string, code: string, type = "keydown", repeat = false) =>
    act(() =>
      window.dispatchEvent(new KeyboardEvent(type, { key, code, repeat, cancelable: true })),
    );
  try {
    render();
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "");
    document.body.append(editable);
    act(() =>
      editable.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a", code: "KeyA", bubbles: true }),
      ),
    );
    expect(connection.input).not.toHaveBeenCalled();
    key("a", "KeyA", "keyup");
    editable.remove();
    key("w", "KeyW");
    key("ArrowUp", "ArrowUp");
    key("w", "KeyW", "keydown", true);
    expect(connection.input.mock.calls).toEqual([[0, 3]]);
    key("w", "KeyW", "keyup");
    expect(connection.input).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event("blur")));
    key("ArrowUp", "ArrowUp", "keydown", true);
    expect(connection.input).toHaveBeenCalledTimes(1);
    key("ArrowUp", "ArrowUp", "keyup");
    key("a", "KeyA");
    expect(connection.input.mock.lastCall).toEqual([0, 1]);
    render(true);
    key("d", "KeyD");
    render();
    key("d", "KeyD", "keydown", true);
    expect(connection.input).toHaveBeenCalledTimes(2);
    key("d", "KeyD", "keyup");
    key("d", "KeyD");
    expect(connection.input.mock.lastCall).toEqual([0, 2]);
    key(" ", "Space");
    expect(host.querySelector('[aria-label="Race menu"]')).not.toBeNull();
    key("Escape", "Escape");
    expect(host.querySelector('[aria-label="Race menu"]')).toBeNull();
    const before = connection.input.mock.calls.length;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    key("d", "KeyD", "keydown", true);
    expect(connection.input).toHaveBeenCalledTimes(before);
    key("d", "KeyD", "keyup");
    key("D", "KeyD");
    expect(connection.input.mock.lastCall).toEqual([0, 2]);
    state.status = "Reconnecting";
    render();
    key("a", "KeyA");
    expect(connection.input).toHaveBeenCalledTimes(before + 1);
    state.status = "Connected";
    render();
    key("a", "KeyA", "keydown", true);
    expect(connection.input).toHaveBeenCalledTimes(before + 1);
    key("a", "KeyA", "keyup");
    key("A", "KeyA");
    expect(connection.input.mock.lastCall).toEqual([0, 1]);
    act(() => root.render(null));
    const unmounted = connection.input.mock.calls.length;
    key("w", "KeyW");
    expect(connection.input).toHaveBeenCalledTimes(unmounted);
    render();
    key("W", "KeyW");
    expect(connection.input.mock.calls.slice(unmounted)).toEqual([[0, 3]]);
    key("m", "KeyM");
    expect(audio.setEnabled).toHaveBeenCalledWith(false);
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
  const calls = connection.input.mock.calls.length;
  key("w", "KeyW");
  expect(connection.input).toHaveBeenCalledTimes(calls);
});
