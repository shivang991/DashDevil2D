# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: baseline.spec.ts >> public app: five-second start, actual canvas, keyboard pause and mute
- Location: tests/browser/baseline.spec.ts:6:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: locator('.game-overlay')
Expected: "1"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveText" locator('.game-overlay') with timeout 5000ms
  - waiting for locator('.game-overlay')

```

```yaml
- heading "Branding" [level=1]
- paragraph: Accelerating! Hit [Space] to pause
- 'img "Health: 1 of 2"'
- paragraph: "Score: 0"
- button "Mute sound" [pressed]: Sound on
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import fs from 'node:fs';
  3  | import os from 'node:os';
  4  | import path from 'node:path';
  5  | const evidence = path.resolve('../docs/preservation/evidence');
  6  | test('public app: five-second start, actual canvas, keyboard pause and mute', async ({ page, browser }) => {
  7  |   await page.clock.install({ time: new Date('2026-10-14T19:00:00Z') });
  8  |   // Randomness seed at the platform boundary, not product internals.
  9  |   await page.addInitScript(() => { let seed = 21; Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }; });
  10 |   await page.goto('http://127.0.0.1:4173');
  11 |   await page.getByText('Solo Trip', { exact: true }).click();
  12 |   await expect(page.locator('.game-overlay')).toHaveText('5');
  13 |   const dimensions = await page.locator('canvas').evaluate(c => { const canvas = c as HTMLCanvasElement; const r = canvas.getBoundingClientRect(); return { width: canvas.width, height: canvas.height, css: { width: r.width, height: r.height } }; });
  14 |   fs.writeFileSync(path.join(evidence, 'browser-environment.json'), JSON.stringify({ baselineRevision: 'a68f27efd1d79ec8eea7ef0b0a6d8567606189dd', fixtureVersion: 1, randomSeed: 21, viewport: { width: 1280, height: 900 }, canvas: dimensions, browser: browser.version(), platform: os.platform(), release: os.release(), architecture: os.arch(), memoryBytes: os.totalmem(), cpu: os.cpus()[0].model, humanReview: 'pending', audioAudition: 'pending', powerSettings: 'unrecorded', referenceHardwareEquivalence: 'not established' }, null, 2));
  15 |   await page.screenshot({ path: path.join(evidence, 'baseline-countdown.png') });
> 16 |   await page.clock.runFor(4900); await expect(page.locator('.game-overlay')).toHaveText('1');
     |                                                                              ^ Error: expect(locator).toHaveText(expected) failed
  17 |   await page.clock.runFor(150); await expect(page.locator('.game-overlay')).toHaveCount(0);
  18 |   await expect(page.getByRole('img', { name: 'Health: 2 of 2' })).toBeVisible();
  19 |   await page.keyboard.down('ArrowUp'); await page.clock.runFor(400);
  20 |   await page.screenshot({ path: path.join(evidence, 'baseline-acceleration.png') });
  21 |   await page.keyboard.up('ArrowUp'); await page.keyboard.press('Space'); await page.clock.runFor(20);
  22 |   await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  23 |   await page.screenshot({ path: path.join(evidence, 'baseline-pause.png') });
  24 |   await page.clock.runFor(5000); await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  25 |   await page.getByRole('button', { name: 'Mute sound' }).click();
  26 |   await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible();
  27 |   await page.reload(); await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible();
  28 | });
  29 | 
```