import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "./Avatar";
const meta = {
  title: "Components/Avatar",
  component: Avatar,
  args: { username: "Driver_01" },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Initials: Story = {};
export const EmptyName: Story = { args: { username: "" } };
export const Preview: Story = {
  args: {
    preview:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' fill='%232563eb'/%3E%3Ccircle cx='24' cy='24' r='12' fill='%23fff'/%3E%3C/svg%3E",
  },
};
export const FailedImage: Story = { args: { preview: "data:image/png;base64,broken" } };
