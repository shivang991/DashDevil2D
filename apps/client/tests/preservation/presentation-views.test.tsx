import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MultiplayerView } from "@/screens/MultiplayerView";
import { MenuScreen } from "@/screens/MenuScreen";
import { disconnected, lobby, outcome, room } from "@/stories/fixtures";
import { captureConfiguration } from "@dashdevil/simulation/config";
import { configurationContext } from "@dashdevil/contracts/validation";

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
  vi.useRealTimers();
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
  vi.useFakeTimers();
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
  act(() => vi.advanceTimersByTime(1000));
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Round Over");
  render();
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Starting");
  expect(actions.leave).not.toHaveBeenCalled();
});

function renderMultiplayer(overrides: Partial<ComponentProps<typeof MultiplayerView>> = {}) {
  const props = {
    mode: 1 as const,
    onBack: vi.fn(),
    playerName: "Driver",
    state: disconnected,
    clock: 0,
    focused: true,
    actions: {
      connect: vi.fn(async () => {}),
      command: vi.fn(),
      leave: vi.fn(),
      releaseControls: vi.fn(),
    },
    ...overrides,
  };
  act(() => root.render(<MultiplayerView {...props} />));
  return props;
}
function getButton(name: string) {
  const button = Array.from(host.querySelectorAll("button")).find(
    (button) => (button.getAttribute("aria-label") ?? button.textContent?.trim()) === name,
  );
  if (!button) throw new Error(`Missing button: ${name}`);
  return button;
}
function clickButton(name: string) {
  act(() => getButton(name).click());
}

test.each([1, 2] as const)("mode %s honors its captured round-over delay", (mode) => {
  vi.useFakeTimers();
  const context = configurationContext(
    captureConfiguration(mode === 1 ? "drag-race" : "road-rage", {
      presentation: { roundOverDelay: 2.5 },
    }),
  );
  renderMultiplayer({
    mode,
    state: { ...lobby, context, room: { ...room, mode, phase: 3 }, outcome },
    renderRace: () => <div>Final scene</div>,
  });
  act(() => vi.advanceTimersByTime(2499));
  expect(host.textContent).toContain("Final scene");
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Round Over");
});

test("a valid long delay never overflows into an immediate result", () => {
  vi.useFakeTimers();
  const context = configurationContext(
    captureConfiguration("drag-race", { presentation: { roundOverDelay: 3_000_000 } }),
  );
  renderMultiplayer({ state: { ...lobby, context, room: { ...room, phase: 3 }, outcome } });
  act(() => vi.advanceTimersByTime(1000));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  act(() => vi.advanceTimersByTime(2_999_998_999));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Round Over");
});

test("outcome receipt starts the delay before room finalization and reconnects preserve it", () => {
  vi.useFakeTimers();
  act(() => vi.advanceTimersByTime(5000));
  const final = {
    ...lobby,
    room: { ...room, phase: 2 },
    outcome,
    diagnostics: { ...lobby.diagnostics, outcomeReceivedUs: 5_000_000 },
  };
  const props = renderMultiplayer({ state: final, renderRace: () => <div>Final scene</div> });
  act(() => vi.advanceTimersByTime(400));
  renderMultiplayer({
    ...props,
    state: {
      ...final,
      status: "Reconnecting",
      room: { ...room, phase: 3 },
      outcome: { ...outcome },
    },
  });
  act(() => vi.advanceTimersByTime(599));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).toContain("Final scene");
  act(() => vi.advanceTimersByTime(1));
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Round Over");
  expect(getButton("Return to Lobby").disabled).toBe(true);
});

test.each(["leave", "new round"])("%s cancels a pending round result", (change) => {
  vi.useFakeTimers();
  const final = { ...lobby, room: { ...room, phase: 3 }, outcome };
  const props = renderMultiplayer({ state: final });
  act(() => vi.advanceTimersByTime(500));
  renderMultiplayer({
    ...props,
    state:
      change === "leave" ? disconnected : { ...lobby, room: { ...room, roundId: 2, phase: 2 } },
  });
  act(() => vi.advanceTimersByTime(1000));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  const nextRound = change === "leave" ? room.roundId : 2;
  renderMultiplayer({
    ...props,
    state: {
      ...final,
      room: { ...final.room, roundId: nextRound },
      outcome: { ...outcome, roundId: nextRound },
    },
  });
  act(() => vi.advanceTimersByTime(999));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Round Over");
});

test("an outcome first received after reconnect gets the full delay", () => {
  vi.useFakeTimers();
  const props = renderMultiplayer({
    state: { ...lobby, status: "Reconnecting", room: { ...room, phase: 3 } },
  });
  act(() => vi.advanceTimersByTime(5000));
  renderMultiplayer({
    ...props,
    state: {
      ...props.state,
      outcome,
      diagnostics: { ...lobby.diagnostics, outcomeReceivedUs: 5_000_000 },
    },
  });
  act(() => vi.advanceTimersByTime(999));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Round Over");
});

test("round result stays over the race until this player returns, then waits in the lobby", () => {
  vi.useFakeTimers();
  const final = { ...lobby, room: { ...room, phase: 3 }, outcome };
  const props = renderMultiplayer({ state: final, renderRace: () => <div>Completed race</div> });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).toContain("Completed race");
  act(() => vi.advanceTimersByTime(999));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Round Over");
  expect(host.textContent).toContain("Completed race");
  clickButton("Return to Lobby");
  expect(props.actions.command).toHaveBeenCalledWith(5, room.mode, 0, "Returning to lobby");

  act(() =>
    root.render(
      <MultiplayerView
        {...props}
        state={{
          ...final,
          room: {
            ...final.room,
            seats: [{ ...room.seats[0], flags: 9 }, room.seats[1]],
          },
        }}
      />,
    ),
  );
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).toContain("Waiting for other player to return");
  expect(host.textContent).not.toContain("Round Over");
  expect(getButton("Road Rage").disabled).toBe(true);

  act(() =>
    root.render(
      <MultiplayerView
        {...props}
        state={{
          ...final,
          room: { ...room, seats: room.seats.map((seat) => ({ ...seat, flags: 1 })) },
        }}
      />,
    ),
  );
  expect(host.textContent).not.toContain("Round Over");
  expect(host.textContent).toContain("Ready");
});

test("guest readiness keeps Ready disabled and offers a separate cancel control", () => {
  const guest = { ...lobby, identity: { ...lobby.identity!, seat: 1 } };
  const props = renderMultiplayer({ state: guest });
  expect(getButton("Ready").disabled).toBe(true);
  expect(getButton("Cancel ready").disabled).toBe(false);
  clickButton("Cancel ready");
  expect(props.actions.command).toHaveBeenCalledWith(1, room.mode, 0, "Confirming readiness");
});
function escape() {
  act(() =>
    (document.activeElement ?? host).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
}
function enterCode(value: string) {
  const input = host.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
}

test("entry creates the selected mode; only the host can change an existing room", () => {
  const props = renderMultiplayer();
  clickButton("Road Rage");
  clickButton("Create Room");
  expect(props.actions.connect).toHaveBeenCalledWith(0, "", 2);
  renderMultiplayer({ ...props, state: lobby });
  clickButton("Road Rage");
  expect(props.actions.command).toHaveBeenCalledWith(0, 2, 0, "Changing mode");
  renderMultiplayer({ ...props, state: { ...lobby, identity: { ...lobby.identity!, seat: 1 } } });
  expect(getButton("Road Rage").disabled).toBe(true);
  expect(getButton("Drag Race").getAttribute("aria-pressed")).toBe("true");
});

test("host start requires both ready and local focus; readiness remains reversible", () => {
  const waiting = {
    ...lobby,
    room: { ...room, seats: [room.seats[0], { ...room.seats[1], flags: 1 }] },
  };
  const props = renderMultiplayer({ state: waiting });
  expect(getButton("Waiting for player…").disabled).toBe(true);
  clickButton("Cancel ready");
  expect(props.actions.command).toHaveBeenCalledWith(1, 1, 0, "Confirming readiness");
  renderMultiplayer({ ...props, state: lobby });
  clickButton("Start round");
  expect(props.actions.command).toHaveBeenCalledWith(2, 1, 0, "Starting round");
  renderMultiplayer({ ...props, state: lobby, focused: false });
  expect(host.textContent).not.toContain("Start round");
  expect(getButton("Waiting for player…").disabled).toBe(true);
});

test("join keeps leading zeros, blocks dismissal in flight, restores errors, and closes on admission", () => {
  const props = renderMultiplayer();
  clickButton("Join Room");
  enterCode("0042");
  act(() =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(props.actions.connect).toHaveBeenCalledWith(1, "0042");
  renderMultiplayer({ ...props, state: { ...disconnected, pending: "Joining room" } });
  escape();
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Joining");
  expect(props.onBack).not.toHaveBeenCalled();
  expect(host.querySelector("input")).toBeNull();
  renderMultiplayer({
    ...props,
    state: { ...disconnected, status: "Unable to connect: Room not found" },
  });
  const input = host.querySelector("input")!;
  expect(input.value).toBe("0042");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(input);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Room not found");
  renderMultiplayer({ ...props, state: { ...lobby, room: { ...room, mode: 2 } } });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(getButton("Road Rage").getAttribute("aria-pressed")).toBe("true");
  renderMultiplayer(props);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

test("dismissing join returns focus without navigating back", async () => {
  const props = renderMultiplayer();
  clickButton("Join Room");
  escape();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(props.onBack).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(getButton("Join Room"));
});

test("lobby exit always confirms, including with a previous result, and explains host transfer", () => {
  const props = renderMultiplayer({ state: { ...lobby, outcome } });
  act(() => getButton("Leave").focus());
  escape();
  expect(document.activeElement).toBe(getButton("Cancel"));
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain(
    "Driver 02 becomes the host.",
  );
  expect(props.actions.leave).not.toHaveBeenCalled();
  clickButton("Cancel");
  expect(props.actions.leave).not.toHaveBeenCalled();
  clickButton("Leave");
  clickButton("Confirm leave");
  expect(props.actions.leave).toHaveBeenCalledOnce();
});

test("server countdown cancellation returns to lobby with feedback and no ready checks", () => {
  const props = renderMultiplayer({ state: { ...lobby, room: { ...room, phase: 1 } } });
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Starting");
  renderMultiplayer({ ...props, state: { ...props.state, status: "Reconnecting" } });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.querySelector('[data-testid="connection-state"]')?.textContent).toBe("Reconnecting");
  renderMultiplayer({
    ...props,
    state: {
      ...lobby,
      room: { ...room, seats: room.seats.map((seat) => ({ ...seat, flags: 1 })) },
      notice: "Countdown cancelled. Both players must ready again.",
    },
  });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "lost connection, or hid the game",
  );
  expect(host.querySelectorAll('svg[aria-label="Ready"]')).toHaveLength(0);
  expect(getButton("Ready").disabled).toBe(false);
});
