import type { Preview } from "@storybook/react-vite";
import "@fontsource-variable/bitcount-ink";
import "@fontsource/bruno-ace-sc";
import "../src/index.css";

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    controls: { matchers: { color: /(background|color)$/i } },
    backgrounds: { options: { game: { name: "Game", value: "#0a0a0a" } } },
  },
  initialGlobals: { backgrounds: { value: "game" } },
};
export default preview;
