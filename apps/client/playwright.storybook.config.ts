import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/storybook",
  workers: 2,
  retries: 0,
  outputDir: "test-results/storybook",
  use: {
    baseURL: "http://127.0.0.1:6007",
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "pnpm exec vite preview --outDir storybook-static --host 127.0.0.1 --port 6007 --strictPort",
    url: "http://127.0.0.1:6007",
    reuseExistingServer: false,
  },
});
