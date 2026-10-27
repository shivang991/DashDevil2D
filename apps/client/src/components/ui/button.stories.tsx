import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ArrowRight } from "lucide-react";
import { Button } from "./button";

const meta = {
  title: "Controls/Button",
  component: Button,
  parameters: { layout: "centered" },
  args: { children: "Start game", onClick: fn() },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Destructive: Story = { args: { variant: "destructive", children: "Leave room" } };
export const WithIcon: Story = {
  args: {
    children: (
      <>
        Continue <ArrowRight />
      </>
    ),
  },
};
export const IconOnly: Story = {
  args: { children: <ArrowRight />, size: "icon", "aria-label": "Continue" },
};
export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3 p-6">
      {(["default", "destructive", "outline", "secondary", "ghost", "link"] as const).map(
        (variant) => (
          <Button {...args} key={variant} variant={variant}>
            {variant}
          </Button>
        ),
      )}
    </div>
  ),
};
export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3 p-6">
      {(["xs", "sm", "default", "lg"] as const).map((size) => (
        <Button {...args} key={size} size={size}>
          {size}
        </Button>
      ))}
    </div>
  ),
};
