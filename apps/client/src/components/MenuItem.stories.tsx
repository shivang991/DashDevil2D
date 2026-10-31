import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { MenuItem } from "./MenuItem";
const meta = {
  title: "Controls/Game menu button",
  component: MenuItem,
  parameters: { layout: "centered" },
  args: { title: "Long Drive", subtitle: "Single player runner", onClick: fn() },
  decorators: [
    (Story) => (
      <div className="w-80 p-4 bg-neutral-950">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MenuItem>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Available: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await expect(args.onClick).toHaveBeenCalled();
  },
};
export const ComingSoon: Story = {
  args: { disabled: true, comingSoon: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button")).toBeDisabled();
  },
};
