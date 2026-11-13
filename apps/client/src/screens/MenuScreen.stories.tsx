import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { accountAPI } from "@/transport/account";
import { account } from "@/stories/accountFixtures";
import { MenuScreen } from "./MenuScreen";
const meta = {
  title: "Screens/Menu",
  component: MenuScreen,
  beforeEach() {
    mocked(accountAPI.history).mockResolvedValue({ races: [], hasNext: false });
  },
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
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Choose Your Abyss")).toBeVisible();
    const row = canvas.getByRole("button", { name: /Long Drive/ });
    await expect(row).toHaveStyle({ borderTopWidth: "0px" });
  },
};
export const LongUsername: Story = {
  args: { account: { ...account, username: "Driver_With_A_Very_Long_Name" } },
};
export const Navigation: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Account menu" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(canvas.getByText(account.username));
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(canvas.getByLabelText(`${account.username} avatar`));
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    await expect(body.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Profile",
      "Race History",
      "Logout",
    ]);
    await userEvent.keyboard("{Escape}");
    await expect(trigger).toHaveFocus();
    await expect(body.queryByRole("menu")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Admin" })).not.toBeInTheDocument();
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(body.getByRole("menuitem", { name: "Profile" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(body.getByRole("menuitem", { name: "Race History" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(body.getByRole("menuitem", { name: "Logout" })).toHaveFocus();
    await userEvent.keyboard("{Home}{Enter}");
    const profile = await body.findByRole("dialog", { name: "Profile" });
    await expect(profile).toBeVisible();
    await expect(profile.contains(canvasElement.ownerDocument.activeElement)).toBe(true);
    await expect(body.queryByRole("menu")).not.toBeInTheDocument();
    await expect(within(profile).queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.click(body.getByRole("menuitem", { name: "Race History" }));
    await expect(await body.findByRole("dialog", { name: "Race History" })).toBeVisible();
    await expect(body.queryByRole("menu")).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "Close" }));
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.click(canvas.getByRole("heading", { name: "Dash Devil" }));
    await expect(body.queryByRole("menu")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /Long Drive/ }));
    await expect(args.onStartGame).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: /Drag Race/ }));
    await expect(args.onMultiplayer).toHaveBeenCalledWith(1);
    await userEvent.click(canvas.getByRole("button", { name: /Road Rage/ }));
    await expect(args.onMultiplayer).toHaveBeenCalledWith(2);
    await userEvent.click(trigger);
    await userEvent.click(body.getByRole("menuitem", { name: "Logout" }));
    await expect(args.onLogout).toHaveBeenCalledTimes(1);
    await expect(body.queryByRole("menu")).not.toBeInTheDocument();
  },
};

export const Guest: Story = {
  args: { account: undefined, playerName: undefined },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Account menu" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Admin" })).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText(/avatar/)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /Long Drive/ }));
    await expect(args.onStartGame).toHaveBeenCalled();
    await expect(canvas.getByRole("button", { name: /Drag Race/ })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: /Road Rage/ })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Login to play multiplayer" }));
    await expect(args.onLogin).toHaveBeenCalled();
  },
};
export const TemporaryPassword: Story = {
  args: { account: { ...account, mustChangePassword: true } },
  play: Guest.play,
};
export const Admin: Story = {
  args: { account: { ...account, admin: true } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const admin = canvas.getByRole("button", { name: "Admin" });
    await expect(admin.getBoundingClientRect().top).toBeGreaterThan(
      canvas.getByRole("button", { name: /Road Rage/ }).getBoundingClientRect().bottom,
    );
    await expect(canvas.queryByText("Only visible to you")).not.toBeInTheDocument();
    await userEvent.click(admin);
    await expect(args.onAdmin).toHaveBeenCalled();
  },
};

export const AccountRefresh: Story = {
  render: function AccountRefresh(args) {
    const [current, setCurrent] = useState(args.account);
    return (
      <>
        <button onClick={() => setCurrent({ ...account, username: "Updated_Driver" })}>
          Refresh account
        </button>
        <MenuScreen {...args} account={current} />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Refresh account" }));
    await userEvent.click(canvas.getByRole("button", { name: "Account menu" }));
    await userEvent.click(body.getByRole("menuitem", { name: "Profile" }));
    await expect(within(body.getByRole("dialog")).getByText("Updated_Driver")).toBeVisible();
  },
};
