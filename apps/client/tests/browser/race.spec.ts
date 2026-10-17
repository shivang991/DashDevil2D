import { test, expect } from '@playwright/test';

for (const delivery of ['clean', 'delayed', 'recovering']) test(`two actual browsers drive and confirm one finish (${delivery})`, async ({ browser, baseURL }, info) => {
  const delayedAuthority = delivery !== 'clean', recovering = delivery === 'recovering';
  test.setTimeout(45000);
  const contexts = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })]);
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  try {
    for (const page of pages) {
      if (delayedAuthority) await page.addInitScript(({ recovering }) => {
        // Application delivery fixture over actual WebTransport. It preserves
        // authority stream order and does not establish a network-profile result.
        const Native = window.WebTransport;
        let corrupted = false;
        window.WebTransport = class extends Native {
          private verification?: WebTransportDatagramDuplexStream;
          get datagrams() {
            if (!this.verification) {
              const original = super.datagrams;
              const readable = original.readable.pipeThrough(new TransformStream({
                transform(bytes: Uint8Array, controller) {
                  if (recovering && !corrupted && Number(document.querySelector('[data-testid="round-time"]')?.textContent ?? 0) >= 2500000) {
                    bytes = bytes.slice(); bytes[9] ^= 1; corrupted = true;
                    document.documentElement.dataset.raceRecoveryFixture = 'corrupted';
                  }
                  controller.enqueue(bytes);
                },
              }));
              this.verification = new Proxy(original, { get(target, name) { return name === 'readable' ? readable : Reflect.get(target, name, target); } });
            }
            return this.verification;
          }
          get incomingUnidirectionalStreams() {
            return super.incomingUnidirectionalStreams.pipeThrough(new TransformStream({
              transform(stream: ReadableStream<Uint8Array>, controller) {
                const reader = stream.getReader(); let cancelled = false;
                controller.enqueue(new ReadableStream<Uint8Array>({
                  start(output) {
                    let buffer = new Uint8Array(), releaseAt = 0;
                    void (async () => { for (;;) {
                      const { value, done } = await reader.read();
                      if (done) break;
                      const combined = new Uint8Array(buffer.length + value.length); combined.set(buffer); combined.set(value, buffer.length); buffer = combined;
                      while (buffer.length >= 4) {
                        const length = new DataView(buffer.buffer).getUint32(0) + 4;
                        if (length > 65536) throw new Error('Fixture frame exceeds protocol limit');
                        if (buffer.length < length) break;
                        const frame = buffer.slice(0, length); buffer = buffer.slice(length);
                        const delay = recovering && corrupted && frame[4] === 19 ? 700 : 250;
                        releaseAt = Math.max(releaseAt, performance.now() + delay);
                        setTimeout(() => { if (!cancelled) output.enqueue(frame); }, Math.max(0, releaseAt - performance.now()));
                      }
                    } })().catch(error => { if (!cancelled) output.error(error); });
                  },
                  cancel() { cancelled = true; void reader.cancel(); },
                }));
              },
            }));
          }
        };
      }, { recovering });
      await page.goto('/'); await page.getByRole('button', { name: /Drag Race/ }).click(); }
    await pages[0].getByRole('button', { name: 'Create Room', exact: true }).click();
    await expect(pages[0].getByTestId('connection-state')).toHaveText('Connected');
    const code = await pages[0].getByTestId('room-code').innerText();
    await pages[1].getByLabel('Room code').fill(code); await pages[1].getByRole('button', { name: 'Join Room', exact: true }).click();
    await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected');
    for (const page of pages) await page.getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(pages[0].getByRole('button', { name: 'Start round' })).toBeEnabled();
    await pages[0].getByRole('button', { name: 'Start round' }).click();
    for (const page of pages) { await expect(page.getByTestId('countdown')).toBeVisible(); await page.keyboard.press('ArrowUp'); }
    for (const page of pages) await expect(page.getByRole('heading', { name: 'Drag Race', exact: true })).toBeVisible();
    const canvas = pages[0].getByRole('img', { name: 'Multiplayer race' });
    await expect(canvas).toBeVisible(); await canvas.focus();
    await pages[0].keyboard.down('ArrowUp');
    await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS active');
    // Platform event fixture for an off-window keyup: no W keyup is
    // delivered between blur and a fresh press. Not physical OS-focus evidence.
    await canvas.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true })));
    await pages[0].evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS ready');
    await canvas.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true })));
    await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS active');
    await pages[0].keyboard.down('ArrowRight');
    await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS ready');
    await pages[0].keyboard.up('ArrowRight'); await pages[0].keyboard.up('ArrowUp');
    await pages[0].keyboard.down('ArrowUp');
    await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS active');
    await info.attach('race.png', { body: await pages[0].screenshot({ fullPage: true }), contentType: 'image/png' });
    for (const page of pages) await expect(page.getByRole('heading', { name: 'Round result' })).toBeVisible({ timeout: 15000 });
    if (delayedAuthority) await pages[0].waitForTimeout(1200); // Allow late authority to reach the already-finalized clients.
    if (recovering) for (const page of pages) await expect(page.locator('html')).toHaveAttribute('data-race-recovery-fixture', 'corrupted');
    const outcomes = await Promise.all(pages.map(p => p.getByTestId('outcome-evidence').textContent().then(v => JSON.parse(v!))));
    expect(outcomes[0].result).toBe(0); expect(outcomes[0].reason).toBe(0);
    expect(outcomes[0].timeUs).toBe(outcomes[1].timeUs); expect(outcomes[0].cars).toEqual(outcomes[1].cars);
    expect(outcomes[0].cars[0].progress).toBeCloseTo(2360, 6);
    const evidence = await Promise.all(pages.map(page => page.getByTestId('room-evidence').textContent().then(v => JSON.parse(v!))));
    expect(evidence[0].startUs).toBe(evidence[1].startUs);
    expect(evidence[0].roundId).toBe(evidence[1].roundId);
    expect(evidence[0].errors).toEqual([]); expect(evidence[1].errors).toEqual([]);
    expect(evidence[0].verified).toBeGreaterThan(0); expect(evidence[1].verified).toBeGreaterThan(0);
    expect(evidence[0].diagnostics.localInputs).toBeGreaterThan(0);
    expect(evidence[1].diagnostics.remoteRecords).toBeGreaterThan(0);
    const environments = await Promise.all(pages.map(page => page.evaluate(() => ({ userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight } }))));
    await info.attach('outcomes.json', { body: JSON.stringify({ outcomes, evidence, environments, delivery }), contentType: 'application/json' });
    for (let i = 0; i < pages.length; i++) await info.attach(`result-${i}.png`, { body: await pages[i].screenshot({ fullPage: true }), contentType: 'image/png' });
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
