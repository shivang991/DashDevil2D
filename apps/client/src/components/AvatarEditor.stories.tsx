import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { AvatarEditor } from "./AvatarEditor";

const meta = {
  title: "Components/Avatar Editor",
  component: AvatarEditor,
  args: { username: "Driver_01", disabled: false, onChange: fn(), onError: fn() },
  decorators: [
    (Story) => (
      <div className="flex max-w-sm flex-col gap-4 p-6 text-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AvatarEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const UploadAndRemove: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const data = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      ),
      (character) => character.charCodeAt(0),
    );
    await userEvent.upload(
      canvas.getByLabelText("Avatar", { exact: true }),
      new File([data], "avatar.png", { type: "image/png" }),
    );
    await expect(await canvas.findByRole("button", { name: "Remove avatar" })).toBeVisible();
    await expect(args.onChange).toHaveBeenCalledWith({ value: expect.any(String), reading: false });
    await userEvent.click(canvas.getByRole("button", { name: "Remove avatar" }));
    await expect(args.onChange).toHaveBeenLastCalledWith({ value: "", reading: false });
  },
};
