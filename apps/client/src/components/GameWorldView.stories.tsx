import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { GameWorldView } from "./GameWorldView";
const playing = {
  health: 2,
  maxHealth: 2,
  score: 120,
  status: "playing",
  paused: false,
  gameOverAnimDone: false,
  countdown: 0,
  accelerating: false,
} as const;
const meta = {
  title: "Screens/Long Drive",
  component: GameWorldView,
  args: { ui: playing, onBack: fn() },
  parameters: {
    docs: {
      description: {
        component:
          "Deterministic HUD and overlays. Canvas intentionally idle: no simulation, audio, or keyboard listeners.",
      },
    },
  },
} satisfies Meta<typeof GameWorldView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playing: Story = {};
export const Countdown: Story = {
  args: { ui: { ...playing, status: "countdown", countdown: 3, score: 0 } },
};
export const Accelerating: Story = { args: { ui: { ...playing, accelerating: true } } };
export const LowHealth: Story = { args: { ui: { ...playing, health: 1 } } };
export const Paused: Story = { args: { ui: { ...playing, paused: true } } };
export const GameOver: Story = {
  args: { ui: { ...playing, status: "gameover", health: 0, gameOverAnimDone: true } },
};
