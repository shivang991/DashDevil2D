import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {
      builder: { viteConfigPath: fileURLToPath(new URL("./vite.config.ts", import.meta.url)) },
    },
  },
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
};
export default config;
