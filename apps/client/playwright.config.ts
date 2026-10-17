import path from 'node:path';
import fs from 'node:fs';
import { defineConfig } from '@playwright/test';
import { createCaptureRun } from './tests/browser/capture';
const capture = createCaptureRun({
  outputRoot: path.resolve('test-results'), repositoryRoot: path.resolve('../..'), fixtureVersion: 3,
  fixtures: ['packages/contracts/simulation/fixtures.json', 'apps/client/tests/browser/multiplayer.spec.ts', 'apps/client/tests/browser/multiplayer.html', 'packages/contracts/track/fixtures.json', 'apps/client/tests/browser/track.spec.ts', 'apps/client/tests/browser/track.html', 'apps/client/tests/browser/evidence.ts', 'packages/contracts/configuration/fixtures.json', 'apps/client/tests/browser/configuration.spec.ts', 'apps/client/tests/browser/configuration.html', 'apps/client/tests/browser/baseline.spec.ts', 'apps/client/tests/browser/capture.ts', 'apps/client/tests/browser/capture-reporter.ts'],
  configuration: ['packages/contracts/configuration/defaults.json', 'apps/client/src/lib/constants.ts', 'apps/client/playwright.config.ts', 'apps/client/package.json', 'pnpm-lock.yaml', 'package.json', 'turbo.json', 'pnpm-workspace.yaml', '.node-version', '.go-version', 'packages/simulation/package.json', 'packages/simulation/config.ts', 'packages/simulation/track.ts', 'packages/simulation/multiplayer.ts', 'packages/simulation/multiplayerTrack.ts', 'packages/simulation/longDrive.ts', 'packages/simulation/state.ts'],
});
// Worker processes evaluate this file too. Share one invocation directory
// through their inherited environment instead of creating a second run identity.
const outputDirectory = process.env.DASHDEVIL_CAPTURE_RUN_DIR ?? capture.directory;
if (process.env.DASHDEVIL_CAPTURE_RUN_DIR) fs.rmdirSync(capture.directory);
else process.env.DASHDEVIL_CAPTURE_RUN_DIR = outputDirectory;
if (path.dirname(outputDirectory) !== path.resolve('test-results') || !path.basename(outputDirectory).startsWith('run-')) {
  throw new Error('Capture run directory must be inside test-results');
}
export default defineConfig({
  testDir: './tests/browser', testIgnore: 'transport.spec.ts', retries: 0, workers: 1,
  outputDir: outputDirectory,
  metadata: { captureProvenance: capture.provenance },
  reporter: [['list'], ['./tests/browser/capture-reporter.ts']],
  use: { viewport: { width: 1280, height: 900 }, channel: 'chrome', screenshot: 'only-on-failure', trace: 'on', video: { mode: 'on', size: { width: 1280, height: 900 } } },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
