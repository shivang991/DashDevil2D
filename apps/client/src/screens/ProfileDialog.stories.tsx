import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { accountAPI } from "@/transport/account";
import { account } from "@/stories/accountFixtures";
import { ProfileDialog } from "./ProfileDialog";

const meta = {
  title: "Screens/Profile",
  component: ProfileDialog,
  args: { account, onLogout: fn(async () => {}), onSaved: fn() },
  beforeEach() {
    mocked(accountAPI.updateProfile).mockResolvedValue({ ...account, username: "Driver_renamed" });
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Profile" }));
    await expect(
      within(canvasElement.ownerDocument.body).getByRole("dialog", { name: "Profile" }),
    ).toBeVisible();
  },
} satisfies Meta<typeof ProfileDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Open: Story = {};
export const Save: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Profile" }));
    await userEvent.clear(body.getByLabelText("Username"));
    await userEvent.type(body.getByLabelText("Username"), "Driver_renamed");
    await userEvent.click(body.getByRole("button", { name: "Save" }));
    await expect(body.getByRole("status")).toHaveTextContent("Profile saved");
    await expect(args.onSaved).toHaveBeenCalledWith({ ...account, username: "Driver_renamed" });
  },
};
export const SaveError: Story = {
  beforeEach() {
    mocked(accountAPI.updateProfile).mockRejectedValue(new Error("Username already taken"));
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Profile" }));
    await userEvent.type(body.getByLabelText("Username"), "_taken");
    await userEvent.click(body.getByRole("button", { name: "Save" }));
    await expect(body.getByRole("alert")).toHaveTextContent("Username already taken");
  },
};
export const ChangePassword: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Profile" }));
    await userEvent.click(body.getByRole("button", { name: "Change password" }));
    await expect(body.getByLabelText("Current password")).toBeVisible();
    await expect(body.getByLabelText("Confirm new password")).toBeVisible();
  },
};
