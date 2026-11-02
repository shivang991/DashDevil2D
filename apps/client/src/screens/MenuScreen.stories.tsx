import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { account } from "@/stories/accountFixtures";
import { MenuScreen } from "./MenuScreen";
const meta = {
  title: "Screens/Menu",
  component: MenuScreen,
  args: {
    account,
    onLogin: fn(),
    onAdmin: fn(),
    onLogout: fn(async () => {}),
    onAccountSaved: fn(),
    playerName: "Driver 01",
    onStartGame: fn(),
    onMultiplayer: fn(),
  },
} satisfies Meta<typeof MenuScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Navigation: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Long Drive/ }));
    await expect(args.onStartGame).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: /Drag Race/ }));
    await expect(args.onMultiplayer).toHaveBeenCalledWith(1);
    await userEvent.click(canvas.getByRole("button", { name: /Road Rage/ }));
    await expect(args.onMultiplayer).toHaveBeenCalledWith(2);
  },
};

export const Guest: Story = {
  args: { account: undefined, playerName: undefined },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /Drag Race/ })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: /Road Rage/ })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Login to play multiplayer" }));
    await expect(args.onLogin).toHaveBeenCalled();
  },
};
export const TemporaryPassword: Story = {
  args: { account: { ...account, mustChangePassword: true } },
};
export const Admin: Story = {
  args: { account: { ...account, admin: true } },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Admin" }));
    await expect(args.onAdmin).toHaveBeenCalled();
  },
};
