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
    await userEvent.click((await canvas.findAllByRole("button", { name: /^Edit / }))[0]);
    await expect(within(canvasElement.ownerDocument.body).getByLabelText("Username")).toHaveValue(
      "Driver_01",
    );
  },
};
export const DeleteConfirmation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "More actions for Driver_01" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole("menuitem", { name: "Delete user" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(canvas.getByRole("button", { name: "More actions for Driver_02" }));
    await userEvent.click(body.getByRole("menuitem", { name: "Delete user" }));
    await expect(body.getByRole("alertdialog")).toBeVisible();
    await expect(adminAPI.delete).not.toHaveBeenCalled();
  },
};
export const ResetConfirmation: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "More actions for Driver_02" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole("menuitem", { name: "Reset password" }));
    await expect(body.getByRole("alertdialog")).toBeVisible();
    await expect(adminAPI.reset).not.toHaveBeenCalled();
  },
};

export const SearchUsers: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Driver_02");
    await userEvent.type(canvas.getByRole("textbox", { name: "Search users" }), "driver_02");
    await expect(canvas.queryByText("Driver_01")).not.toBeInTheDocument();
    await expect(canvas.getByText("Driver_02")).toBeVisible();
    await userEvent.type(canvas.getByRole("textbox", { name: "Search users" }), "missing");
    await expect(canvas.getByText("No matching users")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
    await expect(canvas.getByText("Driver_01")).toBeVisible();
  },
};
export const ManyUsers: Story = {
  beforeEach() {
    mocked(adminAPI.users).mockResolvedValue({
      users: Array.from({ length: 45 }, (_, index) => ({
        ...managedUsers[0],
        id: index + 1,
        username: `Driver_${String(index + 1).padStart(2, "0")}`,
        admin: index === 0,
        createdAt: new Date(2026, 0, index + 1).toISOString(),
      })),
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Driver_01");
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(canvas.getByText("21–40 of 45 users")).toBeVisible();
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "Sort by" }), "createdAt");
    await expect(canvas.getByText("1–20 of 45 users")).toBeVisible();
    await expect(canvas.getAllByRole("row")[1]).toHaveTextContent("Driver_45");
  },
};
export const CreateUser: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Create user" }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(body.getByRole("textbox", { name: "New username" }), "New_Driver");
    await userEvent.type(body.getByRole("textbox", { name: /^Password$/ }), "chosen-password");
    await userEvent.click(
      within(body.getByRole("dialog")).getByRole("button", { name: "Create user" }),
    );
    await expect(await canvas.findByRole("textbox", { name: /^Password$/ })).toHaveValue(
      "chosen-password",
    );
    await expect(adminAPI.create).toHaveBeenCalledWith("New_Driver", "chosen-password");
  },
};
export const RetryLoading: Story = {
  beforeEach() {
    mocked(adminAPI.users)
      .mockRejectedValueOnce(new globalThis.Error("Unable to list users"))
      .mockResolvedValue({ users: managedUsers });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Retry" }));
    await expect(await canvas.findByText("Driver_01")).toBeVisible();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};
