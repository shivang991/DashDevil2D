import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { expect, mocked, userEvent, within } from "storybook/test";
import { chatAPI } from "@/transport/chat";
import { account, chatSnapshot, peer } from "@/stories/accountFixtures";
import { ChatShell } from "./Chat";

const meta = {
  title: "Components/Chat",
  component: ChatShell,
  args: { account, children: <div className="p-6 text-white">Chat preview</div> },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  beforeEach() {
    const key = `dashdevil-chat:${account.id}`;
    const previous = localStorage.getItem(key);
    localStorage.removeItem(key);
    mocked(chatAPI.sync).mockResolvedValue(chatSnapshot);
    mocked(chatAPI.thread).mockResolvedValue({
      messages: [
        {
          id: 1,
          sender: peer.id,
          recipient: account.id,
          text: "Ready for another race?",
          key: "preview-message",
          createdAt: Date.UTC(2026, 0, 1, 12),
        },
      ],
      challenges: [],
    });
    mocked(chatAPI.search).mockResolvedValue({ users: [peer], total: 1 });
    mocked(chatAPI.read).mockResolvedValue({ ok: true });
    return () => {
      if (previous === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous);
    };
  },
} satisfies Meta<typeof ChatShell>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Collapsed: Story = {};
export const Conversations: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open chat" }));
    await expect(
      await canvas.findByRole("button", { name: "Open conversation with Driver_02" }),
    ).toBeVisible();
  },
};
export const Thread: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open chat" }));
    await userEvent.click(
      await canvas.findByRole("button", { name: "Open conversation with Driver_02" }),
    );
    await expect(await canvas.findByText("Ready for another race?")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Send" })).toBeDisabled();
    await userEvent.type(canvas.getByLabelText("Message"), "Let’s race!");
    await expect(canvas.getByRole("button", { name: "Send" })).toBeEnabled();
  },
};
export const Empty: Story = {
  beforeEach() {
    mocked(chatAPI.sync).mockResolvedValue({
      ...chatSnapshot,
      pinned: null,
      acquaintances: [],
      suggested: [],
      unread: 0,
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open chat" }));
    await expect(
      await canvas.findByText("Search for a driver to start a conversation."),
    ).toBeVisible();
  },
};
export const Error: Story = {
  beforeEach() {
    mocked(chatAPI.sync).mockRejectedValue(new globalThis.Error("Chat unavailable. Retry"));
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open chat" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Chat unavailable. Retry");
  },
};
