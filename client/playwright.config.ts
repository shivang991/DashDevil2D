import path from 'node:path';
import fs from 'node:fs';
import { defineConfig } from '@playwright/test';
import { createCaptureRun } from './tests/browser/capture';
const capture = createCaptureRun({
  outputRoot: path.resolve('test-results'), repositoryRoot: path.resolve('..'), fixtureVersion: 1,
  fixtures: ['client/tests/browser/baseline.spec.ts', 'client/tests/browser/capture.ts', 'client/tests/browser/capture-reporter.ts'],
  configuration: ['client/src/lib/constants.ts', 'client/playwright.config.ts', 'client/package.json', 'client/pnpm-lock.yaml'],
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
  testDir: './tests/browser', retries: 0, workers: 1,
  outputDir: outputDirectory,
  metadata: { captureProvenance: capture.provenance },
  reporter: [['list'], ['./tests/browser/capture-reporter.ts']],
  use: { viewport: { width: 1280, height: 900 }, channel: 'chrome', screenshot: 'only-on-failure', trace: 'on', video: { mode: 'on', size: { width: 1280, height: 900 } } },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
