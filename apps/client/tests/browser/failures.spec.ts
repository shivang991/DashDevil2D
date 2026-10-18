import { test, expect, type Page } from '@playwright/test';

const read = async (page: Page) => JSON.parse((await page.getByTestId('room-evidence').textContent())!);

for (const mode of ['Drag Race', 'Road Rage']) test(`${mode}: ordinary traffic, stalled essential input, paired recovery and fresh controls`, async ({ browser, baseURL }, info) => {
  test.setTimeout(110000);
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const errors: string[] = [];
  for (const page of pages) page.on('pageerror', error => errors.push(error.message));
  try {
    // Stall the browser's public transport writer once. Traffic before and after
    // the injected stall still uses native QUIC; replacement pairs are untouched.
    await pages[1].addInitScript(() => {
      const Native = window.WebTransport;
      let stall = false;
      (window as unknown as { stallInput: () => void }).stallInput = () => { stall = true; };
      window.WebTransport = class extends Native {
        async createUnidirectionalStream() {
          const native = await super.createUnidirectionalStream();
          const writer = native.getWriter();
          return new WritableStream<Uint8Array>({
            write(bytes) {
              if (stall) { stall = false; return new Promise<void>(() => {}); }
              return writer.write(bytes);
            },
            abort(reason) { return writer.abort(reason); },
          });
        }
      };
    });
    for (const page of pages) { await page.goto('/'); await page.getByRole('button', { name: new RegExp(mode) }).click(); }
    await pages[0].getByRole('button', { name: 'Create Room', exact: true }).click();
    await expect(pages[0].getByTestId('connection-state')).toHaveText('Connected');
    const code = await pages[0].getByTestId('room-code').innerText();
    await pages[1].getByLabel('Room code').fill(code); await pages[1].getByLabel('Room code').press('Enter');
    await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected');
    for (const page of pages) await page.getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(pages[0].getByRole('button', { name: 'Start round' })).toBeEnabled();
    await pages[0].getByRole('button', { name: 'Start round' }).click();
    for (const page of pages) await expect(page.getByRole('img', { name: 'Multiplayer race' })).toBeVisible({ timeout: 10000 });
    const start = await Promise.all(pages.map(read));
    const startMs = Date.now();
    await pages[0].waitForTimeout(60000);
    const ordinary = await Promise.all(pages.map(read));
    const seconds = (Date.now() - startMs) / 1000;
    for (let seat = 0; seat < 2; seat++) {
      expect(ordinary[seat].identity).toEqual(start[seat].identity);
      expect(ordinary[seat].verified).toBeGreaterThan(start[seat].verified + 100);
      expect(ordinary[seat].errors).toEqual([]);
    }
    const canvas = pages[1].getByRole('img', { name: 'Multiplayer race' });
    await canvas.focus();
    await pages[1].keyboard.down('ArrowUp');
    await expect(pages[1].getByTestId('nos-status')).toHaveText('NOS active');
    await pages[1].evaluate(() => (window as unknown as { stallInput: () => void }).stallInput());
    await expect.poll(async () => (await read(pages[1])).identity.pairGeneration, { timeout: 12000 }).toBeGreaterThan(ordinary[1].identity.pairGeneration);
    await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected', { timeout: 10000 });
    await expect(pages[1].getByTestId('nos-status')).toHaveText('NOS ready');
    const recovered = await read(pages[1]);
    expect(recovered.identity.seatSession).toBe(ordinary[1].identity.seatSession);
    expect(recovered.cars[1].heldMask).toBe(0);
    expect(recovered.errors).toContain('Reliable write stalled');
    await pages[1].keyboard.up('ArrowUp');
    await canvas.focus(); await pages[1].keyboard.down('ArrowUp');
    await expect(pages[1].getByTestId('nos-status')).toHaveText('NOS active');
    await pages[1].keyboard.up('ArrowUp');
    expect(errors).toEqual([]);
    await info.attach('failure-recovery.png', { body: await pages[1].screenshot(), contentType: 'image/png' });
    const bandwidth = ordinary.map((state, seat) => ({
      seat, seconds,
      applicationSentBytesPerSecond: (state.diagnostics.reliableAttemptedBytes - start[seat].diagnostics.reliableAttemptedBytes) / seconds,
      applicationReceivedBytesPerSecond: ((state.diagnostics.reliableReceivedBytes + state.diagnostics.verificationReceivedBytes) - (start[seat].diagnostics.reliableReceivedBytes + start[seat].diagnostics.verificationReceivedBytes)) / seconds,
      initializationBaselineBytes: start[seat].baselineBytes,
    }));
    await info.attach('failure-diagnostics.json', { body: JSON.stringify({ mode, start, ordinary, recovered, bandwidth, scope: 'Application byte diagnostics only; excludes WebSocket, TLS, QUIC, UDP/IP overhead. This is not acceptance of the network budget.', userAgent: await pages[0].evaluate(() => navigator.userAgent) }, null, 2), contentType: 'application/json' });
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
