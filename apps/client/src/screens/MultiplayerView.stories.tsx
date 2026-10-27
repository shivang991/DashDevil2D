import { useMemo, useState, type ComponentProps } from "react";
import { RaceView } from "@/components/RaceView";
import { playingFixture } from "@/stories/playingFixture";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { MultiplayerView } from "./MultiplayerView";
import { disconnected, lobby, outcome, room } from "@/stories/fixtures";
const meta = {
  title: "Screens/Multiplayer",
  component: MultiplayerView,
  args: {
    mode: 1,
    onBack: fn(),
    playerName: "Driver 01",
    state: disconnected,
    clock: 0,
    focused: true,
    actions: { connect: fn(async () => {}), command: fn(), leave: fn(), releaseControls: fn() },
  },
} satisfies Meta<typeof MultiplayerView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Entry: Story = {};
export const RoadRage: Story = { args: { mode: 2 } };
export const Loading: Story = { args: { state: undefined } };
export const Joining: Story = { args: { state: { ...disconnected, pending: "Joining room" } } };
export const Error: Story = { args: { error: "Unable to join: room is full." } };
export const JoinError: Story = {
  ...Error,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Join Room" }));
    await userEvent.type(canvas.getByLabelText("Room code"), "0042");
  },
};
export const Creating: Story = { args: { state: { ...disconnected, pending: "Creating room" } } };
export const Guest: Story = {
  args: { state: { ...lobby, identity: { ...lobby.identity!, seat: 1 } } },
};
export const HostNotReady: Story = {
  args: {
    state: {
      ...lobby,
      room: { ...room, seats: room.seats.map((seat) => ({ ...seat, flags: 1 })) },
    },
  },
};
export const CountdownCancelled: Story = {
  ...HostNotReady,
  args: {
    state: {
      ...HostNotReady.args!.state!,
      notice: "Countdown cancelled. Both players must ready again.",
    },
  },
};
export const ReadyToStart: Story = { args: { state: lobby } };
export const WaitingForPlayer: Story = {
  args: {
    state: {
      ...lobby,
      room: {
        ...room,
        seats: [room.seats[0], { session: 0, name: "", flags: 0, reservationUs: 0 }],
      },
    },
  },
};
export const Reconnecting: Story = { args: { state: { ...lobby, status: "Reconnecting" } } };
export const Countdown: Story = {
  args: { state: { ...lobby, room: { ...room, phase: 1 }, roundId: 1, startUs: room.startUs } },
};
export const Synchronizing: Story = { args: { state: { ...lobby, room: { ...room, phase: 2 } } } };
export const ResultInLobby: Story = { args: { state: { ...lobby, outcome } } };
export const LeaveConfirmation: Story = {
  ...Countdown,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Leave" }));
    await expect(canvas.getByRole("dialog")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Cancel" })).toHaveFocus();
  },
};
export const JoinWithCode: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Join Room" }));
    await expect(canvas.getByRole("button", { name: "Join Room" })).toBeDisabled();
    await userEvent.type(canvas.getByLabelText("Room code"), "1234");
    await userEvent.click(canvas.getByRole("button", { name: "Join Room" }));
    await expect(args.actions?.connect).toHaveBeenCalledWith(1, "1234");
  },
};

const dragRace = playingFixture(1);
const roadRage = playingFixture(2);

function PlayingPreview(args: ComponentProps<typeof MultiplayerView>) {
  // Each mount owns sound preferences and mock controls; nothing touches saved game settings.
  const [audio] = useState(() => ({
    enabled: false,
    setEnabled(enabled: boolean) {
      this.enabled = enabled;
    },
  }));
  const connection = useMemo(
    () => ({
      frame: () => (args.mode === 2 ? roadRage.frame : dragRace.frame),
      input: fn(),
      releaseControls: fn(),
      recordDraw: () => {},
      recordResultCommit: () => {},
    }),
    [args.mode],
  );
  return (
    <MultiplayerView
      {...args}
      renderRace={(props) => (
        <RaceView {...props} connection={connection} state={args.state!} audio={audio} />
      )}
    />
  );
}

export const PlayingDragRace: Story = {
  args: { state: dragRace.state },
  render: PlayingPreview,
  parameters: {
    docs: {
      description: {
        story:
          "Real race renderer with fixed cars, road objects, and HUD. Inputs are mocked; no server or advancing simulation. Menu and sound controls remain interactive.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("img", { name: "Multiplayer race" })).toBeVisible();
    await waitFor(() => expect(canvas.getByTestId("nos-status")).toHaveAttribute("data-nos-state", "active"));
    await expect(canvas.getByTestId("distance-remaining")).toHaveTextContent("% left");
  },
};
export const PlayingRoadRage: Story = {
  ...PlayingDragRace,
  args: { mode: 2, state: roadRage.state },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("img", { name: "Multiplayer race" })).toBeVisible();
    const seconds = Math.max(0, roadRage.state.context!.gameplay.timeLimit - 38);
    await waitFor(() =>
      expect(canvas.getByTestId("time-remaining")).toHaveTextContent(
        `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
      ),
    );
  },
};
export const PlayingReconnecting: Story = {
  ...PlayingDragRace,
  args: { state: { ...dragRace.state, status: "Reconnecting" } },
};
export const PlayingMenu: Story = {
  ...PlayingDragRace,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "[ESC] Menu" }));
    await expect(canvas.getByRole("dialog", { name: "Race menu" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Resume" })).toHaveFocus();
  },
};
export const PlayingLeaveConfirmation: Story = {
  ...PlayingDragRace,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "[ESC] Menu" }));
    await userEvent.click(canvas.getByRole("button", { name: "Leave" }));
    await expect(canvas.getByRole("dialog", { name: "Leave room?" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Cancel" })).toHaveFocus();
  },
};
