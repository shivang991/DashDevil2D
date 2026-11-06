import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { accountAPI } from "@/transport/account";
import { account } from "@/stories/accountFixtures";
import { LoginScreen } from "./LoginScreen";

const meta = {
  title: "Screens/Login",
  component: LoginScreen,
  args: { onAuthenticated: fn(), onBack: fn(), onLogout: fn(async () => {}) },
  beforeEach() {
    mocked(accountAPI.login).mockResolvedValue(account);
    mocked(accountAPI.changeTemporaryPassword).mockResolvedValue(account);
  },
} satisfies Meta<typeof LoginScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Login: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Username"), "Driver_01");
    await userEvent.type(canvas.getByLabelText("Password"), "storybook-password");
    await userEvent.keyboard("{Enter}");
    await expect(args.onAuthenticated).toHaveBeenCalledWith(account);
  },
};
export const InvalidCredentials: Story = {
  beforeEach() {
    mocked(accountAPI.login).mockRejectedValue(new Error("Invalid username or password"));
  },
  play: async (context) => {
    const canvas = within(context.canvasElement);
    await userEvent.type(canvas.getByLabelText("Username"), "Driver_01");
    await userEvent.type(canvas.getByLabelText("Password"), "wrong-password");
    await userEvent.click(canvas.getByRole("button", { name: "Login" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("Invalid username or password");
  },
};
export const TemporaryPassword: Story = {
  args: { account: { ...account, mustChangePassword: true } },
};
export const PasswordMismatch: Story = {
  ...TemporaryPassword,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("New password"), "new-password");
    await userEvent.type(canvas.getByLabelText("Confirm new password"), "different-password");
    await userEvent.click(canvas.getByRole("button", { name: "Save password" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("Passwords do not match");
    await expect(canvas.getByLabelText("Confirm new password")).toBeInvalid();
    await expect(accountAPI.changeTemporaryPassword).not.toHaveBeenCalled();
  },
};
export const ChangeTemporaryPassword: Story = {
  ...TemporaryPassword,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("New password"), "new-password");
    await userEvent.type(canvas.getByLabelText("Confirm new password"), "new-password");
    await userEvent.click(canvas.getByRole("button", { name: "Save password" }));
    await expect(args.onAuthenticated).toHaveBeenCalledWith(account);
  },
};
