# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: baseline.spec.ts >> audio unavailable still allows gameplay
- Location: tests/browser/baseline.spec.ts:104:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('canvas')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('canvas') with timeout 5000ms
  - waiting for locator('canvas')
    - waiting for navigation to finish...
    - navigated to "http://127.0.0.1:4173/"

```

```yaml
- heading "Branding" [level=1]
- paragraph: Driver 6024a3
- button "Long Drive Single player runner"
- button "Drag Race Private two-player race"
- button "Road Rage Multiplayer aggressive run"
- button "Mute sound" [pressed]: Sound on
```

# Test source

```ts
  11  |     const NativeContext = window.AudioContext;
  12  |     const recordings = [];
  13  |     const sinks = new WeakMap();
  14  |     const originalConnect = AudioNode.prototype.connect;
  15  |     AudioNode.prototype.connect = function(...args) {
  16  |       const result = originalConnect.apply(this, args);
  17  |       const sink = sinks.get(this.context);
  18  |       if (sink && args[0] === this.context.destination) originalConnect.call(this, sink);
  19  |       return result;
  20  |     };
  21  |     window.AudioContext = class extends NativeContext {
  22  |       constructor(...args) {
  23  |         super(...args);
  24  |         const sink = this.createMediaStreamDestination();
  25  |         sinks.set(this, sink);
  26  |         const chunks = [];
  27  |         const recorder = new MediaRecorder(sink.stream);
  28  |         recorder.ondataavailable = e => chunks.push(e.data);
  29  |         recorder.start();
  30  |         const analyser = this.createAnalyser();
  31  |         this.createMediaStreamSource(sink.stream).connect(analyser);
  32  |         recordings.push({ recorder, chunks, analyser });
  33  |       }
  34  |     };
  35  |     window.baselineAudioRms = () => {
  36  |       const analyser = recordings[0].analyser;
  37  |       const data = new Float32Array(analyser.fftSize);
  38  |       analyser.getFloatTimeDomainData(data);
  39  |       return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
  40  |     };
  41  |     window.finishBaselineAudio = async () => {
  42  |       if (!recordings.length) return null;
  43  |       const { recorder, chunks } = recordings[0];
  44  |       await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
  45  |       return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  46  |     };
  47  |   `;
  48  | test('public app: five-second start, actual canvas, keyboard pause and mute', async ({ page, browser, evidence }, testInfo) => {
  49  |   await page.clock.install({ time: new Date('2026-10-14T19:00:00Z') });
  50  |   await page.clock.pauseAt(new Date('2026-10-14T19:00:01Z'));
  51  |   // Randomness seed at the platform boundary, not product internals.
  52  |   await page.addInitScript(seedPlatformRandomness);
  53  |   await page.goto('http://127.0.0.1:4173');
  54  |   await page.getByText('Long Drive', { exact: true }).click();
  55  |   await expect(page.locator('.game-overlay')).toHaveText('5');
  56  |   const dimensions = await page.locator('canvas').evaluate(c => { const canvas = c as HTMLCanvasElement; const r = canvas.getBoundingClientRect(); return { width: canvas.width, height: canvas.height, css: { width: r.width, height: r.height } }; });
  57  |   fs.writeFileSync(path.join(evidence, 'browser-environment.json'), JSON.stringify({ provenance: testInfo.config.metadata.captureProvenance, randomSeed: 21, viewport: { width: 1280, height: 900 }, canvas: dimensions, browser: browser.version(), platform: os.platform(), release: os.release(), architecture: os.arch(), memoryBytes: os.totalmem(), cpu: os.cpus()[0].model, humanReview: 'pending', audioAudition: 'pending', powerSettings: 'unrecorded', referenceHardwareEquivalence: 'not established' }, null, 2));
  58  |   await page.screenshot({ path: path.join(evidence, 'baseline-countdown.png') });
  59  |   await page.clock.runFor(4900); await expect(page.locator('.game-overlay')).toHaveText('1');
  60  |   await page.clock.runFor(150); await expect(page.locator('.game-overlay')).toHaveCount(0);
  61  |   await expect(page.getByRole('img', { name: 'Health: 2 of 2' })).toBeVisible();
  62  |   await page.keyboard.down('ArrowUp'); await page.clock.runFor(400);
  63  |   await page.keyboard.up('ArrowUp'); await page.keyboard.press('Space'); await page.clock.runFor(20);
  64  |   await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  65  |   await page.clock.runFor(5000); await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  66  |   await page.getByRole('button', { name: 'Mute sound' }).click();
  67  |   await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible();
  68  |   await page.reload(); await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible();
  69  | });
  70  | 
  71  | test('record real-time public presentation for later human comparison', async ({ page, evidence }) => {
  72  |   test.setTimeout(65000);
  73  |   // Capture Web Audio's actual output through a parallel platform recording sink.
  74  |   // This records audio bytes; it does not establish human-perceived equivalence.
  75  |   await page.addInitScript(audioCaptureScript);
  76  |   await page.addInitScript(seedPlatformRandomness);
  77  |   await page.goto('http://127.0.0.1:4173');
  78  |   await page.getByText('Long Drive', { exact: true }).click();
  79  |   await expect(page.locator('.game-overlay')).toHaveCount(0, { timeout: 7000 });
  80  |   await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500);
  81  |   await page.screenshot({ path: path.join(evidence, 'baseline-acceleration.png') });
  82  |   await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500);
  83  |   await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowUp');
  84  |   await page.keyboard.press('Space'); await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  85  |   await page.waitForTimeout(150);
  86  |   await page.screenshot({ path: path.join(evidence, 'baseline-pause.png') });
  87  |   await page.setViewportSize({ width: 800, height: 600 });
  88  |   const dimensions = await page.locator('canvas').evaluate(c => ({ width: (c as HTMLCanvasElement).width, height: (c as HTMLCanvasElement).height }));
  89  |   fs.writeFileSync(path.join(evidence, 'resize-environment.json'), JSON.stringify({ viewport: { width: 800, height: 600 }, canvas: dimensions, collisionEquivalence: 'not established; #26 owns corrected geometry' }, null, 2));
  90  |   await page.screenshot({ path: path.join(evidence, 'baseline-resize-pause.png') });
  91  |   await page.setViewportSize({ width: 1280, height: 900 });
  92  |   await page.keyboard.press('Space');
  93  |   await page.keyboard.down('ArrowRight'); await page.waitForTimeout(50); await page.keyboard.up('ArrowRight');
  94  |   await expect(page.getByText('GAME OVER', { exact: true })).toBeVisible({ timeout: 45000 });
  95  |   await page.screenshot({ path: path.join(evidence, 'baseline-gameover.png') });
  96  |   await page.getByRole('button', { name: 'Back to Menu' }).click();
  97  |   await expect(page.getByText('Long Drive', { exact: true })).toBeVisible();
  98  |   const audio = await page.evaluate('finishBaselineAudio()') as number[] | null;
  99  |   if (audio) fs.writeFileSync(path.join(evidence, 'baseline-audio.webm'), Buffer.from(audio));
  100 |   fs.writeFileSync(path.join(evidence, 'audio-capture.json'), JSON.stringify({ recordedBytes: audio?.length ?? 0, method: 'parallel Web Audio MediaStreamDestination', captures: ['countdown/GO', 'engine', 'acceleration/release', 'lane change', 'pause/resume', 'damage', 'gameover'], missing: ['coin cue not independently isolated', 'hidden-tab mute'], humanAudition: 'pending' }, null, 2));
  101 | 
  102 | });
  103 | 
  104 | test('audio unavailable still allows gameplay', async ({ page }) => {
  105 |   await page.addInitScript('window.AudioContext = class { constructor() { throw new Error("Audio unavailable fixture"); } };');
  106 |   await page.clock.install({ time: new Date('2026-10-14T19:00:00Z') });
  107 |   await page.clock.pauseAt(new Date('2026-10-14T19:00:01Z'));
  108 |   await page.goto('http://127.0.0.1:4173');
  109 |   await page.getByText('Long Drive', { exact: true }).click();
  110 |   await page.clock.runFor(5100);
> 111 |   await expect(page.locator('canvas')).toBeVisible();
      |                                        ^ Error: expect(locator).toBeVisible() failed
  112 |   await expect(page.locator('.game-overlay')).toHaveCount(0);
  113 | });
  114 | 
  115 | test('isolated coin cue from public seeded gameplay', async ({ page, evidence }) => {
  116 |   await page.addInitScript(audioCaptureScript);
  117 |   // Seed 5408: first lane word 0x56269a32, coin word 0x297388c2.
  118 |   await page.addInitScript(() => { Math.random = () => (5408 - .5) / 0xffffffff; });
  119 |   await page.clock.install({ time: new Date('2026-10-14T19:00:00Z') });
  120 |   await page.clock.pauseAt(new Date('2026-10-14T19:00:01Z'));
  121 |   await page.goto('http://127.0.0.1:4173');
  122 |   await page.getByText('Long Drive', { exact: true }).click();
  123 |   await page.clock.runFor(5050);
  124 |   await page.clock.runFor(2900);
  125 |   await expect(page.getByText('Score: 10', { exact: true })).toBeVisible();
  126 |   await page.waitForTimeout(1000);
  127 |   const visibleRms = await page.evaluate('baselineAudioRms()') as number;
  128 |   await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  129 |   await page.waitForTimeout(300);
  130 |   const hiddenRms = await page.evaluate('baselineAudioRms()') as number;
  131 |   expect(visibleRms).toBeGreaterThan(0.000001);
  132 |   expect(hiddenRms).toBeLessThan(0.000001);
  133 |   fs.writeFileSync(path.join(evidence, 'audio-hidden-platform-fixture.json'), JSON.stringify({ visibleRms, hiddenRms, method: 'controlled document.hidden plus actual Web Audio output analyser', nativeTabSuspension: 'not exercised', humanAudition: 'pending' }, null, 2));
  134 |   const audio = await page.evaluate('finishBaselineAudio()') as number[] | null;
  135 |   if (audio) fs.writeFileSync(path.join(evidence, 'baseline-coin-audio.webm'), Buffer.from(audio));
  136 |   await page.screenshot({ path: path.join(evidence, 'baseline-coin.png') });
  137 | });
  138 | 
  139 | test('session focus lifecycle: away countdown freezes and active blur requires fresh resume', async ({ page }) => {
  140 |   await page.clock.install({ time: new Date('2026-10-14T19:00:00Z') });
  141 |   await page.clock.pauseAt(new Date('2026-10-14T19:00:01Z'));
  142 |   await page.goto('http://127.0.0.1:4173');
  143 |   await page.getByText('Long Drive', { exact: true }).click();
  144 |   // Sample beyond the display boundary; RAF registration can precede its first callback.
  145 |   await page.clock.runFor(1100);
  146 |   await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  147 |   await page.clock.runFor(10000); await expect(page.locator('.game-overlay')).toHaveText('4');
  148 |   await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  149 |   await page.clock.runFor(4100); await expect(page.locator('.game-overlay')).toHaveCount(0);
  150 |   await page.keyboard.down('w'); await page.clock.runFor(20);
  151 |   await expect(page.getByText('Accelerating!', { exact: false })).toBeVisible();
  152 |   await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  153 |   await page.clock.runFor(10000); await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  154 |   await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  155 |   await page.clock.runFor(1000); await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  156 |   await page.keyboard.press('Space'); await page.keyboard.down('w'); await page.clock.runFor(20);
  157 |   await expect(page.getByText('Hold [Up/W] to accelerate', { exact: false })).toBeVisible();
  158 |   await page.keyboard.up('w'); await page.keyboard.down('w'); await page.clock.runFor(20);
  159 |   await expect(page.getByText('Accelerating!', { exact: false })).toBeVisible();
  160 |   await page.keyboard.up('w');
  161 | });
  162 | 
  163 | test('native sound control keeps Space behavior and clears held movement', async ({ page }) => {
  164 |   await page.clock.install({ time: new Date('2026-10-14T19:00:00Z') });
  165 |   await page.clock.pauseAt(new Date('2026-10-14T19:00:01Z'));
  166 |   await page.goto('http://127.0.0.1:4173'); await page.getByText('Long Drive', { exact: true }).click();
  167 |   await page.clock.runFor(5100); await page.keyboard.down('w'); await page.clock.runFor(20);
  168 |   await page.getByRole('button', { name: 'Mute sound' }).focus();
  169 |   await page.keyboard.press('Space'); await page.clock.runFor(20);
  170 |   await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible();
  171 |   await expect(page.getByText('PAUSED', { exact: true })).toHaveCount(0);
  172 |   await expect(page.getByText('Hold [Up/W] to accelerate', { exact: false })).toBeVisible();
  173 |   await page.locator('canvas').click(); await page.keyboard.down('w'); await page.clock.runFor(20);
  174 |   await expect(page.getByText('Hold [Up/W] to accelerate', { exact: false })).toBeVisible();
  175 |   await page.keyboard.up('w'); await page.keyboard.down('w'); await page.clock.runFor(20);
  176 |   await expect(page.getByText('Accelerating!', { exact: false })).toBeVisible();
  177 | });
  178 | 
  179 | test('early Enter is discarded; restart and menu-return use fresh three-second countdowns', async ({ page }) => {
  180 |   await page.addInitScript(() => { Math.random = () => 0.5; });
  181 |   await page.clock.install({ time: new Date('2026-10-14T19:00:00Z') });
  182 |   await page.clock.pauseAt(new Date('2026-10-14T19:00:01Z'));
  183 |   await page.goto('http://127.0.0.1:4173'); await page.getByText('Long Drive', { exact: true }).click();
  184 |   await page.keyboard.press('Enter'); await page.clock.runFor(5100);
  185 |   await expect(page.locator('.game-overlay')).toHaveCount(0);
  186 |   for (let i = 0; i < 200 && await page.getByRole('img', { name: 'Health: 0 of 2' }).count() === 0; i++) await page.clock.runFor(50);
  187 |   await expect(page.getByRole('img', { name: 'Health: 0 of 2' })).toBeVisible();
  188 |   await page.keyboard.down('Enter'); await page.clock.runFor(600);
  189 |   await expect(page.getByText('GAME OVER', { exact: true })).toBeVisible();
  190 |   await page.keyboard.up('Enter'); await page.keyboard.press('Enter'); await page.clock.runFor(20);
  191 |   await expect(page.locator('.game-overlay')).toHaveText('3');
  192 |   await page.clock.runFor(3100);
  193 |   await expect(page.locator('.game-overlay')).toHaveCount(0);
  194 |   await page.clock.runFor(11000); await expect(page.getByText('GAME OVER', { exact: true })).toBeVisible();
  195 |   await page.getByRole('button', { name: 'Back to Menu' }).click();
  196 |   await page.keyboard.press('Space'); await expect(page.locator('canvas')).toHaveCount(0);
  197 |   await page.getByText('Long Drive', { exact: true }).click();
  198 |   await expect(page.locator('.game-overlay')).toHaveText('3');
  199 | });
  200 | 
```