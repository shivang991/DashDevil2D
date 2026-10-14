import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', retries: 0, workers: 1,
  use: { viewport: { width: 1280, height: 900 }, channel: 'chrome', screenshot: 'only-on-failure', trace: 'on', video: { mode: 'on', size: { width: 1280, height: 900 } } },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
