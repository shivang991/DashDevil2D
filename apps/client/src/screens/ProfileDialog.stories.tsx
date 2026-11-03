import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { accountAPI } from "@/transport/account";
import { account } from "@/stories/accountFixtures";
import { ProfileDialog } from "./ProfileDialog";

const meta = {
  title: "Screens/Profile",
  component: ProfileDialog,
  args: { account, onSaved: fn() },
  beforeEach() {
    mocked(accountAPI.updateProfile).mockResolvedValue(account);
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Profile" }));
    await expect(
      within(canvasElement.ownerDocument.body).getByRole("dialog", { name: "Profile" }),
    ).toBeVisible();
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.queryByRole("textbox")).not.toBeInTheDocument();
    await expect(body.getByText(account.username)).toBeVisible();
    await expect(body.getByRole("button", { name: "Change avatar" })).toBeVisible();
  },
} satisfies Meta<typeof ProfileDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Open: Story = {};
export const Save: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Profile" }));
    await uploadAvatar(body);
    await userEvent.click(body.getByRole("button", { name: "Save" }));
    await expect(body.getByRole("status")).toHaveTextContent("Profile saved");
    await expect(args.onSaved).toHaveBeenCalledWith(account);
  },
};
export const SaveError: Story = {
  beforeEach() {
    mocked(accountAPI.updateProfile).mockRejectedValue(new Error("Unable to save. Try again"));
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Profile" }));
    await uploadAvatar(body);
    await userEvent.click(body.getByRole("button", { name: "Save" }));
    await expect(body.getByRole("alert")).toHaveTextContent("Unable to save. Try again");
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

async function uploadAvatar(body: ReturnType<typeof within>) {
  const data = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    ),
    (character) => character.charCodeAt(0),
  );
  await userEvent.upload(
    body.getByLabelText("Avatar", { exact: true }),
    new File([data], "avatar.png", { type: "image/png" }),
  );
  await expect(await body.findByRole("button", { name: "Save", exact: true })).toBeEnabled();
}
