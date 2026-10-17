import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';
const file = process.env.DASHDEVIL_TRANSPORT_CONFIG;
if (!file) throw new Error('Run pnpm test:transport so certificates and both listeners are available');
const config = JSON.parse(fs.readFileSync(file, 'utf8')) as { spki: string };
const runDirectory = path.join(path.dirname(file), `browser-${Date.now()}`);
export default defineConfig({
  testDir: './tests/browser', testMatch: process.env.DASHDEVIL_ROOM_TESTS ? 'rooms.spec.ts' : 'transport.spec.ts', retries: 0, workers: 1,
  outputDir: runDirectory,
  reporter: [['list'], ['json', { outputFile: path.join(runDirectory, 'results.json') }]],
  use: {
    baseURL: 'https://127.0.0.1:4173', channel: 'chrome',
    // Scope local HTTPS trust to this certificate's public key. WebTransport
    // separately uses its short-lived certificate hash, with no UDP bypass.
    launchOptions: { args: [`--ignore-certificate-errors-spki-list=${config.spki}`] },
    screenshot: 'only-on-failure', video: 'on', trace: 'off',
  },
  webServer: { command: 'pnpm exec vite --host 127.0.0.1 --port 4173 --strictPort', url: 'https://127.0.0.1:4173/transport.html', ignoreHTTPSErrors: true, reuseExistingServer: false },
});
