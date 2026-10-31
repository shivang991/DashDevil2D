import { expect, test, vi } from "vitest";
import {
  MultiplayerDrivingInput,
  type DrivingInputContext,
} from "../../src/game/MultiplayerDrivingInput";

const active: DrivingInputContext = {
  menu: false,
  suspended: false,
  status: "Connected",
  roundId: 1,
};
function setup() {
  const output = { input: vi.fn(), releaseControls: vi.fn() };
  const clearKeys = vi.fn();
  const driving = new MultiplayerDrivingInput(output, clearKeys);
  driving.update(active);
  output.releaseControls.mockClear();
  clearKeys.mockClear();
  return { driving, output, clearKeys };
}

test("shared sources press once and release only when the final source releases", () => {
  const { driving, output } = setup();
  driving.press("key:KeyW", 3);
  driving.press("key:KeyW", 3);
  driving.press("touch:3", 3);
  driving.press("key:ArrowUp", 3);
  expect(output.input.mock.calls).toEqual([[0, 3]]);
  expect(driving.release("touch:3")).toBe(true);
  expect(driving.release("key:KeyW")).toBe(true);
  expect(driving.release("key:KeyW")).toBe(false);
  expect(driving.release("missing")).toBe(false);
  expect(output.input.mock.calls).toEqual([[0, 3]]);
  driving.release("key:ArrowUp");
  expect(output.input.mock.calls).toEqual([
    [0, 3],
    [1, 3],
  ]);
});

test("different controls pass through in order without synthesizing priority or fallback presses", () => {
  const { driving, output } = setup();
  driving.press("touch:3", 3);
  driving.press("key:KeyA", 1);
  driving.press("key:KeyD", 2);
  driving.release("key:KeyD");
  driving.release("key:KeyA");
  driving.release("touch:3");
  expect(output.input.mock.calls).toEqual([
    [0, 3],
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 1],
    [1, 3],
  ]);
});

test.each([{ menu: true }, { suspended: true }, { status: "Reconnecting" }, { outcome: {} }])(
  "unavailable context %j resets holds and resumes only on fresh input",
  (change) => {
    const { driving, output, clearKeys } = setup();
    driving.press("key:KeyW", 3);
    driving.update({ ...active, ...change });
    expect(output.releaseControls).toHaveBeenCalledTimes(1);
    expect(clearKeys).toHaveBeenCalledTimes(1);
    expect(driving.release("key:KeyW")).toBe(false);
    expect(driving.press("touch:1", 1)).toBe(false);
    driving.update(active);
    expect(output.input.mock.calls).toEqual([[0, 3]]);
    expect(output.releaseControls).toHaveBeenCalledTimes(2);
    expect(driving.press("key:KeyW", 3)).toBe(true);
    expect(output.input.mock.calls).toEqual([
      [0, 3],
      [0, 3],
    ]);
  },
);

test("unchanged snapshots preserve holds; a rematch clears them even when availability stays enabled", () => {
  const { driving, output, clearKeys } = setup();
  driving.press("touch:1", 1);
  driving.update({ ...active });
  expect(output.releaseControls).not.toHaveBeenCalled();
  expect(clearKeys).not.toHaveBeenCalled();
  driving.update({ ...active, roundId: 2 });
  expect(clearKeys).toHaveBeenCalledTimes(1);
  expect(output.releaseControls).toHaveBeenCalledTimes(1);
  expect(driving.release("touch:1")).toBe(false);
  expect(output.input.mock.calls).toEqual([[0, 1]]);
  driving.press("touch:1", 1);
  expect(output.input.mock.calls).toEqual([
    [0, 1],
    [0, 1],
  ]);
});

test("explicit reset synchronously clears sources and keyboard tracking before releasing delivery", () => {
  const calls: string[] = [];
  const driving = new MultiplayerDrivingInput(
    {
      input: (intent, control) => calls.push(`${intent}:${control}`),
      releaseControls: () => calls.push("release-all"),
    },
    () => calls.push("clear-keys"),
  );
  driving.update(active);
  driving.press("touch:3", 3);
  calls.length = 0;
  driving.reset();
  expect(calls).toEqual(["clear-keys", "release-all"]);
  expect(driving.release("touch:3")).toBe(false);
  driving.press("touch:3", 3);
  expect(calls).toEqual(["clear-keys", "release-all", "0:3"]);
});

test("connection admission remains independent: rejected presses remain locally held until reset", () => {
  const { driving, output } = setup();
  // The existing connection returns no acceptance acknowledgment.
  driving.press("key:KeyW", 3);
  driving.press("touch:3", 3);
  expect(output.input.mock.calls).toEqual([[0, 3]]);
  driving.reset();
  driving.press("touch:3", 3);
  expect(output.input.mock.calls).toEqual([
    [0, 3],
    [0, 3],
  ]);
});
