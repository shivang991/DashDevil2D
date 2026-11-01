import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { MenuScreen } from "./MenuScreen";
const meta = {
  title: "Screens/Menu",
  component: MenuScreen,
  args: {
    account: {
      id: 1,
      username: "Driver_01",
      admin: false,
      mustChangePassword: false,
      expires: "2026-12-01T00:00:00Z",
    },
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
