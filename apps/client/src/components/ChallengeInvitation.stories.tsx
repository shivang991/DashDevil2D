import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ChallengeInvitation } from "./ChallengeInvitation";

const meta = {
  title: "Components/Challenge Invitation",
  component: ChallengeInvitation,
  args: {
    invitation: { id: 1, expiresAt: Date.UTC(2099, 0, 1), status: "Pending" },
    incoming: true,
    playing: false,
    inRoom: false,
    onAccept: fn(),
  },
} satisfies Meta<typeof ChallengeInvitation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Incoming: Story = {};
export const Outgoing: Story = { args: { incoming: false } };
export const Playing: Story = { args: { playing: true } };
export const InRoom: Story = { args: { inRoom: true } };
export const Pending: Story = { args: { pending: true } };
export const Accepted: Story = {
  args: { invitation: { ...meta.args.invitation, status: "Accepted" } },
};
export const Expired: Story = { args: { invitation: { ...meta.args.invitation, expiresAt: 0 } } };
export const Unavailable: Story = {
  args: { invitation: { ...meta.args.invitation, status: "Unavailable" } },
};
export const AcceptOnce: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Accept challenge" }));
    await expect(canvas.getByRole("button", { name: "Accepting…" })).toBeDisabled();
    await expect(args.onAccept).toHaveBeenCalledTimes(1);
  },
};
