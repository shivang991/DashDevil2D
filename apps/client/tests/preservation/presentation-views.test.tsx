import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MultiplayerView } from "@/screens/MultiplayerView";
import { MenuScreen } from "@/screens/MenuScreen";
import { lobby, outcome, room } from "@/stories/fixtures";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

test("menu fixtures avoid generating or storing a player identity", () => {
  const storage = vi.spyOn(Storage.prototype, "setItem");
  const multiplayer = vi.fn();
  act(() =>
    root.render(
      <MenuScreen playerName="Fixture driver" onStartGame={vi.fn()} onMultiplayer={multiplayer} />,
    ),
  );
  expect(host.textContent).toContain("Fixture driver");
  act(() =>
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("Road Rage"))!
      .click(),
  );
  expect(multiplayer).toHaveBeenCalledWith(2);
  expect(storage).not.toHaveBeenCalled();
});

test("leave confirmation focuses cancel and resets on a server outcome", () => {
  const actions = {
    connect: vi.fn(async () => {}),
    command: vi.fn(),
    leave: vi.fn(),
    releaseControls: vi.fn(),
  };
  const countdown = { ...lobby, room: { ...room, phase: 1 } };
  const render = (state = countdown) =>
    act(() =>
      root.render(
        <MultiplayerView
          mode={1}
          onBack={vi.fn()}
          playerName="Driver"
          state={state}
          clock={0}
          focused
          actions={actions}
        />,
      ),
    );
  render();
  act(() =>
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent === "Leave")!
      .click(),
  );
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  expect(document.activeElement?.textContent).toBe("Cancel");
  expect(actions.releaseControls).toHaveBeenCalledOnce();
  render({ ...countdown, outcome });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  render();
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(actions.leave).not.toHaveBeenCalled();
});
