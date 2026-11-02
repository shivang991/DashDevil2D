import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { adminAPI } from "@/transport/account";
import { managedUsers } from "@/stories/accountFixtures";
import { AdminScreen } from "./AdminScreen";

const meta = {
  title: "Screens/Admin",
  component: AdminScreen,
  args: { onBack: fn(), onAccountSaved: fn() },
  beforeEach() {
    mocked(adminAPI.users).mockResolvedValue({ users: managedUsers });
  },
} satisfies Meta<typeof AdminScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Users: Story = {};
export const Empty: Story = {
  beforeEach() {
    mocked(adminAPI.users).mockResolvedValue({ users: [] });
  },
};
export const Loading: Story = {
  beforeEach() {
    mocked(adminAPI.users).mockImplementation(() => new Promise(() => {}));
  },
};
export const Error: Story = {
  beforeEach() {
    mocked(adminAPI.users).mockRejectedValue(new globalThis.Error("Unable to list users"));
  },
};
export const Edit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click((await canvas.findAllByRole("button", { name: "Edit" }))[0]);
    await expect(canvas.getByLabelText("Username")).toHaveValue("Driver_01");
  },
};
export const DeleteConfirmation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = await canvas.findAllByRole("button", { name: "Delete" });
    await expect(buttons[0]).toBeDisabled();
    await userEvent.click(buttons[1]);
    await expect(within(canvasElement.ownerDocument.body).getByRole("alertdialog")).toBeVisible();
    await expect(adminAPI.delete).not.toHaveBeenCalled();
  },
};
export const ResetConfirmation: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      (await within(canvasElement).findAllByRole("button", { name: "Reset password" }))[1],
    );
    await expect(within(canvasElement.ownerDocument.body).getByRole("alertdialog")).toBeVisible();
    await expect(adminAPI.reset).not.toHaveBeenCalled();
  },
};
