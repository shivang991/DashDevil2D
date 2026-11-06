import type { Meta, StoryObj } from "@storybook/react-vite";
import type * as React from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { ArrowRight } from "lucide-react";
import { Button } from "./button";

const variants = [
  "default",
  "destructive",
  "danger-outlined",
  "text",
  "chat",
  "multiplayer",
  "outline",
  "secondary",
  "ghost",
  "link",
] as const;

const meta = {
  title: "Controls/Button",
  component: Button,
  parameters: { layout: "centered" },
  args: { children: "Start game", onClick: fn() },
  argTypes: {
    variant: {
      control: "select",
      options: variants,
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
      {variants.map((variant) => (
        <Button {...args} key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
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

function CustomIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M4 12h16M12 4v16" />
    </svg>
  );
}

export const IconLeft: Story = {
  args: { iconLeft: CustomIcon, dividerLeft: true, children: "Custom action" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Custom action" });
    const icon = button.querySelector("svg")!;
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    await expect(icon.getBoundingClientRect().width).toBe(16);
    await expect(canvas.getByRole("separator")).toBeVisible();
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalled();
  },
};
export const DividerWithoutIcon: Story = {
  args: { dividerLeft: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("separator")).not.toBeInTheDocument();
  },
};
export const IconWithoutDivider: Story = {
  args: { iconLeft: ArrowRight },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg")).toBeVisible();
    await expect(within(canvasElement).queryByRole("separator")).not.toBeInTheDocument();
  },
};
export const DangerOutlined: Story = {
  args: { variant: "danger-outlined", iconLeft: ArrowRight, dividerLeft: true, children: "Logout" },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Logout" });
    const style = getComputedStyle(button);
    await expect(style.borderTopWidth).toBe("1px");
    await expect(style.borderTopColor).toBe(style.color);
    await expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    await expect(getComputedStyle(button.querySelector("svg")!).color).toBe(style.color);
    await expect(style.transitionDuration).toBe("0s");
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await expect(getComputedStyle(button).boxShadow).not.toBe("none");
  },
};
export const DisabledIcon: Story = {
  args: { iconLeft: CustomIcon, dividerLeft: true, disabled: true },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button");
    await expect(button).toBeDisabled();
    await expect(button.querySelector("svg")).toBeVisible();
    await expect(getComputedStyle(button).opacity).toBe("0.5");
    await userEvent.tab();
    await expect(button).not.toHaveFocus();
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
export const ComposedIcon: Story = {
  args: {
    asChild: true,
    iconLeft: CustomIcon,
    dividerLeft: true,
    children: <a href="#continue">Continue</a>,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "Continue" });
    await expect(link.querySelector("svg")).toBeVisible();
    await expect(within(link).getByRole("separator")).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
    await userEvent.click(link);
    await expect(args.onClick).toHaveBeenCalled();
  },
};
export const Composed: Story = {
  args: { asChild: true, children: <a href="#continue">Continue</a> },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "#continue",
    );
  },
};
