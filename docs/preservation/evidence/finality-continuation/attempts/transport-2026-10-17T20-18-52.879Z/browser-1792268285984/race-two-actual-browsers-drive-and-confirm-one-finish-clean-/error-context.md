# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: race.spec.ts >> two actual browsers drive and confirm one finish (clean)
- Location: tests/browser/race.spec.ts:3:73

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "[DEBUG-36coverage] Error: insufficient reachable track coverage {\"tick\":44,\"timeUs\":733333,\"cars\":[366.6669333333332,293.33346666666654],\"windows\":[[233.3333333333332,1626.6666666666665]]}",
+ ]
```

# Test source

```ts
  8   |   try {
  9   |     for (const page of pages) {
  10  |       if (delayedAuthority) await page.addInitScript(({ recovering, unordered }) => {
  11  |         // Application delivery fixture over actual WebTransport. It preserves
  12  |         // authority stream order and does not establish a network-profile result.
  13  |         const Native = window.WebTransport;
  14  |         let corrupted = false, corruptions = 0, datagrams = 0, corruptedEpoch: number | undefined;
  15  |         window.WebTransport = class extends Native {
  16  |           private verification?: WebTransportDatagramDuplexStream;
  17  |           get datagrams() {
  18  |             if (!this.verification) {
  19  |               const original = super.datagrams;
  20  |               const readable = original.readable.pipeThrough(new TransformStream({
  21  |                 transform(bytes: Uint8Array, controller) {
  22  |                   datagrams++;
  23  |                   if (unordered && datagrams % 3 === 0) return;
  24  |                   if (unordered && datagrams % 3 === 1) { setTimeout(() => { try { controller.enqueue(bytes); } catch { /* fixture stream closed */ } }, 150); return; }
  25  |                   const epoch = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(0);
  26  |                   if (recovering && corruptions < 3 && (corruptedEpoch === undefined || epoch === corruptedEpoch) && Number(document.querySelector('[data-testid="round-time"]')?.textContent ?? 0) >= 2500000) {
  27  |                     corruptedEpoch ??= epoch; document.documentElement.dataset.raceRecoveryEpoch = String(corruptedEpoch);
  28  |                     bytes = bytes.slice(); bytes[9] ^= 1; corrupted = true; corruptions++;
  29  |                     document.documentElement.dataset.raceRecoveryFixture = 'corrupted';
  30  |                     document.documentElement.dataset.raceCorruptions = String(corruptions);
  31  |                   }
  32  |                   controller.enqueue(bytes);
  33  |                 },
  34  |               }));
  35  |               this.verification = new Proxy(original, { get(target, name) { return name === 'readable' ? readable : Reflect.get(target, name, target); } });
  36  |             }
  37  |             return this.verification;
  38  |           }
  39  |           get incomingUnidirectionalStreams() {
  40  |             return super.incomingUnidirectionalStreams.pipeThrough(new TransformStream({
  41  |               transform(stream: ReadableStream<Uint8Array>, controller) {
  42  |                 const reader = stream.getReader(); let cancelled = false;
  43  |                 controller.enqueue(new ReadableStream<Uint8Array>({
  44  |                   start(output) {
  45  |                     let buffer = new Uint8Array(), releaseAt = 0;
  46  |                     void (async () => { for (;;) {
  47  |                       const { value, done } = await reader.read();
  48  |                       if (done) break;
  49  |                       const combined = new Uint8Array(buffer.length + value.length); combined.set(buffer); combined.set(value, buffer.length); buffer = combined;
  50  |                       while (buffer.length >= 4) {
  51  |                         const length = new DataView(buffer.buffer).getUint32(0) + 4;
  52  |                         if (length > 65536) throw new Error('Fixture frame exceeds protocol limit');
  53  |                         if (buffer.length < length) break;
  54  |                         const frame = buffer.slice(0, length); buffer = buffer.slice(length);
  55  |                         const delay = recovering && corrupted && frame[4] === 19 ? 700 : 250;
  56  |                         releaseAt = Math.max(releaseAt, performance.now() + delay);
  57  |                         setTimeout(() => { if (!cancelled) output.enqueue(frame); }, Math.max(0, releaseAt - performance.now()));
  58  |                       }
  59  |                     } })().catch(error => { if (!cancelled) output.error(error); });
  60  |                   },
  61  |                   cancel() { cancelled = true; void reader.cancel(); },
  62  |                 }));
  63  |               },
  64  |             }));
  65  |           }
  66  |         };
  67  |       }, { recovering, unordered });
  68  |       await page.goto('/'); await page.getByRole('button', { name: /Drag Race/ }).click(); }
  69  |     await pages[0].getByRole('button', { name: 'Create Room', exact: true }).click();
  70  |     await expect(pages[0].getByTestId('connection-state')).toHaveText('Connected');
  71  |     const code = await pages[0].getByTestId('room-code').innerText();
  72  |     await pages[1].getByLabel('Room code').fill(code); await pages[1].getByRole('button', { name: 'Join Room', exact: true }).click();
  73  |     await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected');
  74  |     for (const page of pages) await page.getByRole('button', { name: 'Ready', exact: true }).click();
  75  |     await expect(pages[0].getByRole('button', { name: 'Start round' })).toBeEnabled();
  76  |     await pages[0].getByRole('button', { name: 'Start round' }).click();
  77  |     for (const page of pages) { await expect(page.getByTestId('countdown')).toBeVisible(); await page.keyboard.press('ArrowUp'); }
  78  |     for (const page of pages) await expect(page.getByRole('heading', { name: 'Drag Race', exact: true })).toBeVisible();
  79  |     const canvas = pages[0].getByRole('img', { name: 'Multiplayer race' });
  80  |     await expect(canvas).toBeVisible(); await canvas.focus();
  81  |     await pages[0].keyboard.down('ArrowUp');
  82  |     await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS active');
  83  |     // Platform event fixture for an off-window keyup: no W keyup is
  84  |     // delivered between blur and a fresh press. Not physical OS-focus evidence.
  85  |     await canvas.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true })));
  86  |     await pages[0].evaluate(() => window.dispatchEvent(new Event('blur')));
  87  |     await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS ready');
  88  |     await canvas.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true })));
  89  |     await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS active');
  90  |     await pages[0].keyboard.down('ArrowRight');
  91  |     await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS ready');
  92  |     await pages[0].keyboard.up('ArrowRight'); await pages[0].keyboard.up('ArrowUp');
  93  |     await pages[0].keyboard.down('ArrowUp');
  94  |     await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS active');
  95  |     await info.attach('race.png', { body: await pages[0].screenshot({ fullPage: true }), contentType: 'image/png' });
  96  |     for (const page of pages) await expect(page.getByRole('heading', { name: 'Round result' })).toBeVisible({ timeout: 15000 });
  97  |     if (delayedAuthority) await pages[0].waitForTimeout(1200); // Allow late authority to reach the already-finalized clients.
  98  |     if (recovering) for (const page of pages) await expect(page.locator('html')).toHaveAttribute('data-race-recovery-fixture', 'corrupted');
  99  |     const outcomes = await Promise.all(pages.map(p => p.getByTestId('outcome-evidence').textContent().then(v => JSON.parse(v!))));
  100 |     expect(outcomes[0].result).toBe(0); expect(outcomes[0].reason).toBe(0);
  101 |     expect(outcomes[0].timeUs).toBe(outcomes[1].timeUs); expect(outcomes[0].cars).toEqual(outcomes[1].cars);
  102 |     expect(outcomes[0].cars[0].progress).toBeCloseTo(2360, 6);
  103 |     const evidence = await Promise.all(pages.map(page => page.getByTestId('room-evidence').textContent().then(v => JSON.parse(v!))));
  104 |     const environments = await Promise.all(pages.map(page => page.evaluate(() => ({ userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight } }))));
  105 |     await info.attach('outcomes.json', { body: JSON.stringify({ outcomes, evidence, environments, delivery }), contentType: 'application/json' });
  106 |     expect(evidence[0].startUs).toBe(evidence[1].startUs);
  107 |     expect(evidence[0].roundId).toBe(evidence[1].roundId);
> 108 |     expect(evidence[0].errors).toEqual([]); expect(evidence[1].errors).toEqual([]);
      |                                ^ Error: expect(received).toEqual(expected) // deep equality
  109 |     expect(evidence[0].verified).toBeGreaterThan(0); expect(evidence[1].verified).toBeGreaterThan(0);
  110 |     if (recovering) for (let seat = 0; seat < pages.length; seat++) {
  111 |       const state = evidence[seat];
  112 |       const corruptedEpoch = Number(await pages[seat].locator('html').getAttribute('data-race-recovery-epoch'));
  113 |       await expect(pages[seat].locator('html')).toHaveAttribute('data-race-corruptions', '3');
  114 |       expect(state.diagnostics.recoveryEpochs.filter((epoch: number) => epoch === corruptedEpoch)).toHaveLength(1);
  115 |       expect(new Set(state.diagnostics.recoveryEpochs).size).toBe(state.diagnostics.recoveryEpochs.length);
  116 |       expect(state.diagnostics.baselineEpochs.at(-1)).toBeGreaterThan(corruptedEpoch);
  117 |     }
  118 |     for (const state of evidence) for (const correction of state.diagnostics.corrections ?? []) expect(correction.maxSettlingUs).toBeLessThanOrEqual(250000);
  119 |     expect(evidence[0].diagnostics.localInputs).toBeGreaterThan(0);
  120 |     expect(evidence[1].diagnostics.remoteRecords).toBeGreaterThan(0);
  121 |     for (let i = 0; i < pages.length; i++) await info.attach(`result-${i}.png`, { body: await pages[i].screenshot({ fullPage: true }), contentType: 'image/png' });
  122 |   } finally { await Promise.all(contexts.map(c => c.close())); }
  123 | });
  124 | 
```