# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: baseline.spec.ts >> record real-time public presentation for later human comparison
- Location: tests/browser/baseline.spec.ts:31:1

# Error details

```
Test timeout of 65000ms exceeded.
```

```
Error: locator.evaluate: Test timeout of 65000ms exceeded.
Call log:
  - waiting for locator('canvas')

```

# Page snapshot

```yaml
- generic [ref=f1e2]:
  - generic [ref=f1e4]:
    - heading "Branding" [level=1] [ref=f1e6]
    - generic [ref=f1e7]:
      - button "Solo Trip Single player runner" [ref=f1e9] [cursor=pointer]:
        - generic [ref=f1e10]:
          - generic [ref=f1e11]: Solo Trip
          - generic [ref=f1e12]: Single player runner
      - generic [ref=f1e16]:
        - button "Road Rage Multiplayer aggressive run" [disabled] [ref=f1e17]:
          - generic [ref=f1e18]:
            - generic [ref=f1e19]: Road Rage
            - generic [ref=f1e20]: Multiplayer aggressive run
        - generic [ref=f1e24]: Coming Soon
  - button "Mute sound" [pressed] [ref=f1e25]: Sound on
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
  8  |   await page.clock.pauseAt(new Date('2026-10-14T19:00:01Z'));
  9  |   // Randomness seed at the platform boundary, not product internals.
  10 |   await page.addInitScript(() => { let seed = 21; Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }; });
  11 |   await page.goto('http://127.0.0.1:4173');
  12 |   await page.getByText('Solo Trip', { exact: true }).click();
  13 |   await expect(page.locator('.game-overlay')).toHaveText('5');
  14 |   const dimensions = await page.locator('canvas').evaluate(c => { const canvas = c as HTMLCanvasElement; const r = canvas.getBoundingClientRect(); return { width: canvas.width, height: canvas.height, css: { width: r.width, height: r.height } }; });
  15 |   fs.writeFileSync(path.join(evidence, 'browser-environment.json'), JSON.stringify({ baselineRevision: 'a68f27efd1d79ec8eea7ef0b0a6d8567606189dd', fixtureVersion: 1, randomSeed: 21, viewport: { width: 1280, height: 900 }, canvas: dimensions, browser: browser.version(), platform: os.platform(), release: os.release(), architecture: os.arch(), memoryBytes: os.totalmem(), cpu: os.cpus()[0].model, humanReview: 'pending', audioAudition: 'pending', powerSettings: 'unrecorded', referenceHardwareEquivalence: 'not established' }, null, 2));
  16 |   await page.screenshot({ path: path.join(evidence, 'baseline-countdown.png') });
  17 |   await page.clock.runFor(4900); await expect(page.locator('.game-overlay')).toHaveText('1');
  18 |   await page.clock.runFor(150); await expect(page.locator('.game-overlay')).toHaveCount(0);
  19 |   await expect(page.getByRole('img', { name: 'Health: 2 of 2' })).toBeVisible();
  20 |   await page.keyboard.down('ArrowUp'); await page.clock.runFor(400);
  21 |   await page.screenshot({ path: path.join(evidence, 'baseline-acceleration.png') });
  22 |   await page.keyboard.up('ArrowUp'); await page.keyboard.press('Space'); await page.clock.runFor(20);
  23 |   await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  24 |   await page.screenshot({ path: path.join(evidence, 'baseline-pause.png') });
  25 |   await page.clock.runFor(5000); await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  26 |   await page.getByRole('button', { name: 'Mute sound' }).click();
  27 |   await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible();
  28 |   await page.reload(); await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible();
  29 | });
  30 | 
  31 | test('record real-time public presentation for later human comparison', async ({ page }) => {
  32 |   test.setTimeout(65000);
  33 |   // Capture Web Audio's actual output through a parallel platform recording sink.
  34 |   // This records audio bytes; it does not establish human-perceived equivalence.
  35 |   await page.addInitScript(`
  36 |     const NativeContext = window.AudioContext;
  37 |     const recordings = [];
  38 |     const sinks = new WeakMap();
  39 |     const originalConnect = AudioNode.prototype.connect;
  40 |     AudioNode.prototype.connect = function(...args) {
  41 |       const result = originalConnect.apply(this, args);
  42 |       const sink = sinks.get(this.context);
  43 |       if (sink && args[0] === this.context.destination) originalConnect.call(this, sink);
  44 |       return result;
  45 |     };
  46 |     window.AudioContext = class extends NativeContext {
  47 |       constructor(...args) {
  48 |         super(...args);
  49 |         const sink = this.createMediaStreamDestination();
  50 |         sinks.set(this, sink);
  51 |         const chunks = [];
  52 |         const recorder = new MediaRecorder(sink.stream);
  53 |         recorder.ondataavailable = e => chunks.push(e.data);
  54 |         recorder.start();
  55 |         recordings.push({ recorder, chunks });
  56 |       }
  57 |     };
  58 |     window.finishBaselineAudio = async () => {
  59 |       if (!recordings.length) return null;
  60 |       const { recorder, chunks } = recordings[0];
  61 |       await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
  62 |       return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  63 |     };
  64 |   `);
  65 |   await page.addInitScript(() => { let seed = 21; Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }; });
  66 |   await page.goto('http://127.0.0.1:4173');
  67 |   await page.getByText('Solo Trip', { exact: true }).click();
  68 |   await expect(page.locator('.game-overlay')).toHaveCount(0, { timeout: 7000 });
  69 |   await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500);
  70 |   await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500);
  71 |   await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowUp');
  72 |   await page.keyboard.press('Space'); await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  73 |   await page.keyboard.press('Space');
  74 |   await page.keyboard.down('ArrowRight'); await page.waitForTimeout(50); await page.keyboard.up('ArrowRight');
  75 |   await expect(page.getByText('GAME OVER', { exact: true })).toBeVisible({ timeout: 45000 });
  76 |   await page.screenshot({ path: path.join(evidence, 'baseline-gameover.png') });
  77 |   const audio = await page.evaluate('finishBaselineAudio()') as number[] | null;
  78 |   if (audio) fs.writeFileSync(path.join(evidence, 'baseline-audio.webm'), Buffer.from(audio));
  79 |   fs.writeFileSync(path.join(evidence, 'audio-capture.json'), JSON.stringify({ recordedBytes: audio?.length ?? 0, method: 'parallel Web Audio MediaStreamDestination', captures: ['countdown/GO', 'engine', 'acceleration/release', 'lane change', 'pause/resume', 'damage', 'gameover'], missing: ['coin cue not independently isolated', 'hidden-tab mute'], humanAudition: 'pending' }, null, 2));
  80 |   await page.setViewportSize({ width: 800, height: 600 });
> 81 |   const dimensions = await page.locator('canvas').evaluate(c => ({ width: (c as HTMLCanvasElement).width, height: (c as HTMLCanvasElement).height }));
     |                                                   ^ Error: locator.evaluate: Test timeout of 65000ms exceeded.
  82 |   fs.writeFileSync(path.join(evidence, 'resize-environment.json'), JSON.stringify({ viewport: { width: 800, height: 600 }, canvas: dimensions, collisionEquivalence: 'not established; #26 owns corrected geometry' }, null, 2));
  83 |   await page.screenshot({ path: path.join(evidence, 'baseline-resize-pause.png') });
  84 | });
  85 | 
```