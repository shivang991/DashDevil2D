import {
  OutcomeReasonBothDisconnected,
  OutcomeReasonDeadline,
  OutcomeReasonHP,
  OutcomeResultAbandoned,
  OutcomeResultPlayer2Win,
  OutcomeResultTie,
} from "@dashdevil/contracts/protocol";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoundResult } from "./RoundResult";
import "@/screens/multiplayer.css";
import { outcome } from "@/stories/fixtures";
const meta = {
  title: "Game/Round result",
  component: RoundResult,
  args: { outcome, local: 0 },
  decorators: [
    (Story) => (
      <div className="max-w-lg p-6 text-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoundResult>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Won: Story = {};
export const Lost: Story = {
  args: { outcome: { ...outcome, result: OutcomeResultPlayer2Win, reason: OutcomeReasonHP } },
};
export const Tie: Story = {
  args: { outcome: { ...outcome, result: OutcomeResultTie, reason: OutcomeReasonDeadline } },
};
export const Abandoned: Story = {
  args: {
    outcome: { ...outcome, result: OutcomeResultAbandoned, reason: OutcomeReasonBothDisconnected },
  },
};
