import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const test = base.extend<{ evidence: string }>({
  evidence: async ({ browser }, provideEvidence, testInfo) => {
    const directory = testInfo.outputPath('evidence');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'scenario-environment.json'), JSON.stringify({ provenance: testInfo.config.metadata.captureProvenance, scenario: testInfo.title, browser: browser.version(), viewport: testInfo.project.use.viewport }, null, 2));
    await provideEvidence(directory);
  },
});
function seedPlatformRandomness() {
  let seed = 21;
  Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
}
const audioCaptureScript = `
    const NativeContext = window.AudioContext;
    const recordings = [];
    const sinks = new WeakMap();
    const originalConnect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(...args) {
      const result = originalConnect.apply(this, args);
      const sink = sinks.get(this.context);
      if (sink && args[0] === this.context.destination) originalConnect.call(this, sink);
      return result;
    };
    window.AudioContext = class extends NativeContext {
      constructor(...args) {
        super(...args);
        const sink = this.createMediaStreamDestination();
        sinks.set(this, sink);
        const chunks = [];
        const recorder = new MediaRecorder(sink.stream);
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.start();
        const analyser = this.createAnalyser();
        this.createMediaStreamSource(sink.stream).connect(analyser);
        recordings.push({ recorder, chunks, analyser });
      }
    };
    window.baselineAudioRms = () => {
      const analyser = recordings[0].analyser;
      const data = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
    };
    window.finishBaselineAudio = async () => {
      if (!recordings.length) return null;
      const { recorder, chunks } = recordings[0];
      await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
      return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
    };
  `;
test('public app: five-second start, actual canvas, keyboard pause and mute', async ({ page, browser, evidence }, testInfo) => {
  await page.clock.install({ time: new Date('2026-10-14T19:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-14T19:00:01Z'));
  // Randomness seed at the platform boundary, not product internals.
  await page.addInitScript(seedPlatformRandomness);
  await page.goto('http://127.0.0.1:4173');
  await page.getByText('Long Drive', { exact: true }).click();
  await expect(page.locator('.game-overlay')).toHaveText('5');
  const dimensions = await page.locator('canvas').evaluate(c => { const canvas = c as HTMLCanvasElement; const r = canvas.getBoundingClientRect(); return { width: canvas.width, height: canvas.height, css: { width: r.width, height: r.height } }; });
  fs.writeFileSync(path.join(evidence, 'browser-environment.json'), JSON.stringify({ provenance: testInfo.config.metadata.captureProvenance, randomSeed: 21, viewport: { width: 1280, height: 900 }, canvas: dimensions, browser: browser.version(), platform: os.platform(), release: os.release(), architecture: os.arch(), memoryBytes: os.totalmem(), cpu: os.cpus()[0].model, humanReview: 'pending', audioAudition: 'pending', powerSettings: 'unrecorded', referenceHardwareEquivalence: 'not established' }, null, 2));
  await page.screenshot({ path: path.join(evidence, 'baseline-countdown.png') });
  await page.clock.runFor(4900); await expect(page.locator('.game-overlay')).toHaveText('1');
  await page.clock.runFor(150); await expect(page.locator('.game-overlay')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Health: 2 of 2' })).toBeVisible();
  await page.keyboard.down('ArrowUp'); await page.clock.runFor(400);
  await page.keyboard.up('ArrowUp'); await page.keyboard.press('Space'); await page.clock.runFor(20);
  await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  await page.clock.runFor(5000); await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mute sound' }).click();
  await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible();
  await page.reload(); await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible();
});

test('record real-time public presentation for later human comparison', async ({ page, evidence }) => {
  test.setTimeout(65000);
  // Capture Web Audio's actual output through a parallel platform recording sink.
  // This records audio bytes; it does not establish human-perceived equivalence.
  await page.addInitScript(audioCaptureScript);
  await page.addInitScript(seedPlatformRandomness);
  await page.goto('http://127.0.0.1:4173');
  await page.getByText('Long Drive', { exact: true }).click();
  await expect(page.locator('.game-overlay')).toHaveCount(0, { timeout: 7000 });
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(evidence, 'baseline-acceleration.png') });
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500);
  await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowUp');
  await page.keyboard.press('Space'); await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(evidence, 'baseline-pause.png') });
  await page.setViewportSize({ width: 800, height: 600 });
  const dimensions = await page.locator('canvas').evaluate(c => ({ width: (c as HTMLCanvasElement).width, height: (c as HTMLCanvasElement).height }));
  fs.writeFileSync(path.join(evidence, 'resize-environment.json'), JSON.stringify({ viewport: { width: 800, height: 600 }, canvas: dimensions, collisionEquivalence: 'not established; #26 owns corrected geometry' }, null, 2));
  await page.screenshot({ path: path.join(evidence, 'baseline-resize-pause.png') });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.keyboard.press('Space');
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(50); await page.keyboard.up('ArrowRight');
  await expect(page.getByText('GAME OVER', { exact: true })).toBeVisible({ timeout: 45000 });
  await page.screenshot({ path: path.join(evidence, 'baseline-gameover.png') });
  await page.getByRole('button', { name: 'Back to Menu' }).click();
  await expect(page.getByText('Long Drive', { exact: true })).toBeVisible();
  const audio = await page.evaluate('finishBaselineAudio()') as number[] | null;
  if (audio) fs.writeFileSync(path.join(evidence, 'baseline-audio.webm'), Buffer.from(audio));
  fs.writeFileSync(path.join(evidence, 'audio-capture.json'), JSON.stringify({ recordedBytes: audio?.length ?? 0, method: 'parallel Web Audio MediaStreamDestination', captures: ['countdown/GO', 'engine', 'acceleration/release', 'lane change', 'pause/resume', 'damage', 'gameover'], missing: ['coin cue not independently isolated', 'hidden-tab mute'], humanAudition: 'pending' }, null, 2));

});

test('audio unavailable still allows gameplay', async ({ page }) => {
  await page.addInitScript('window.AudioContext = class { constructor() { throw new Error("Audio unavailable fixture"); } };');
  await page.clock.install({ time: new Date('2026-10-14T19:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-14T19:00:01Z'));
  await page.goto('http://127.0.0.1:4173');
  await page.getByText('Long Drive', { exact: true }).click();
  await page.clock.runFor(5100);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.game-overlay')).toHaveCount(0);
});

test('isolated coin cue from public seeded gameplay', async ({ page, evidence }) => {
  await page.addInitScript(audioCaptureScript);
  await page.addInitScript(() => { Math.random = () => 0.4; });
  await page.clock.install({ time: new Date('2026-10-14T19:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-14T19:00:01Z'));
  await page.goto('http://127.0.0.1:4173');
  await page.getByText('Long Drive', { exact: true }).click();
  await page.clock.runFor(5050);
  await page.clock.runFor(2900);
  await expect(page.getByText('Score: 10', { exact: true })).toBeVisible();
  await page.waitForTimeout(1000);
  const visibleRms = await page.evaluate('baselineAudioRms()') as number;
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  const hiddenRms = await page.evaluate('baselineAudioRms()') as number;
  expect(visibleRms).toBeGreaterThan(0.000001);
  expect(hiddenRms).toBeLessThan(0.000001);
  fs.writeFileSync(path.join(evidence, 'audio-hidden-platform-fixture.json'), JSON.stringify({ visibleRms, hiddenRms, method: 'controlled document.hidden plus actual Web Audio output analyser', nativeTabSuspension: 'not exercised', humanAudition: 'pending' }, null, 2));
  const audio = await page.evaluate('finishBaselineAudio()') as number[] | null;
  if (audio) fs.writeFileSync(path.join(evidence, 'baseline-coin-audio.webm'), Buffer.from(audio));
  await page.screenshot({ path: path.join(evidence, 'baseline-coin.png') });
});
