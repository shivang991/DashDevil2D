import { resetTransportMocks } from "../src/stories/mockTransport";
import { sb } from "storybook/test";
import type { Preview } from "@storybook/react-vite";
import "@fontsource-variable/bitcount-ink";
import "@fontsource/bruno-ace-sc";
import "../src/index.css";

// Keep account and chat stories isolated from real accounts and servers.
sb.mock(import("../src/transport/account.ts"));
sb.mock(import("../src/transport/chat.ts"));

const preview: Preview = {
  tags: ["autodocs"],
  beforeEach: resetTransportMocks,
  parameters: {
    layout: "fullscreen",
    controls: { matchers: { color: /(background|color)$/i } },
    backgrounds: { options: { game: { name: "Game", value: "#0a0a0a" } } },
  },
  initialGlobals: { backgrounds: { value: "game" } },
};
export default preview;
