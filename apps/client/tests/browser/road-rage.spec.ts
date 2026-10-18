import { test, expect, type Page } from '@playwright/test';
const read = async (page: Page) => JSON.parse((await page.getByTestId('room-evidence').textContent())!);
const defaults = Boolean(process.env.DASHDEVIL_RAGE_DEFAULT);
test(defaults ? 'shipped Road Rage survives obstacles until authoritative elimination' : 'Road Rage deadline, separated cars, mode changes and fresh rematch use real transports', async ({ browser, baseURL }, info) => {
  test.setTimeout(100000);
  const contexts = await Promise.all([browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } }), browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } })]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const errors: string[] = [], records: unknown[] = [];
  for (const page of pages) page.on('pageerror', error => errors.push(error.message));
  try {
    for (const page of pages) { await page.goto('/'); await page.getByRole('button', { name: /Road Rage/ }).click(); }
    await pages[0].getByRole('button', { name: 'Create Room', exact: true }).click();
    await expect(pages[0].getByTestId('connection-state')).toHaveText('Connected');
    const code = await pages[0].getByTestId('room-code').innerText();
    await pages[1].getByLabel('Room code').fill(code); await pages[1].getByLabel('Room code').press('Enter');
    await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected');
    const start = async () => {
      for (const page of pages) await page.getByRole('button', { name: 'Ready', exact: true }).click();
      await expect(pages[0].getByRole('button', { name: 'Start round' })).toBeEnabled();
      await pages[0].getByRole('button', { name: 'Start round' }).click();
      for (const page of pages) await expect(page.getByRole('img', { name: 'Multiplayer race' })).toBeVisible();
    };
    await start();
    const initial = await Promise.all(pages.map(read)); records.push({ initial });
    expect(initial[0].context.mode).toBe(2);
    expect(initial[0].context.gameplay.timeLimit).toBe(defaults ? 120 : 8);
    expect(initial[0].context.gameplay.maxHealth).toBe(defaults ? 3 : 6);
    for (const page of pages) { await expect(page.getByTestId('time-remaining')).toBeVisible(); await expect(page.getByRole('progressbar')).toHaveCount(0); }
    if (!defaults) {
      await pages[0].getByRole('img', { name: 'Multiplayer race' }).focus(); await pages[0].keyboard.down('ArrowUp');
      await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS active');
      await expect.poll(async () => { const s = await read(pages[0]); return s.cars[0].progress - s.cars[1].progress; }, { timeout: 6000 }).toBeGreaterThan(1200);
      records.push({ separated: await Promise.all(pages.map(read)) });
      await info.attach('separated.png', { body: await pages[0].screenshot({ fullPage: true }), contentType: 'image/png' });
    }
    await expect.poll(async () => (await read(pages[0])).cars?.some((car: { hp: number }) => car.hp < (defaults ? 3 : 6)), { timeout: 25000 }).toBe(true);
    records.push({ damage: await Promise.all(pages.map(read)) });
    await info.attach('obstacle-survival.png', { body: await pages[0].screenshot({ fullPage: true }), contentType: 'image/png' });
    for (const page of pages) await expect(page.getByRole('heading', { name: 'Round result' })).toBeVisible({ timeout: 65000 });
    await pages[0].keyboard.up('ArrowUp');
    const outcomes = await Promise.all(pages.map(async page => JSON.parse((await page.getByTestId('outcome-evidence').textContent())!)));
    expect(outcomes[0].cars).toEqual(outcomes[1].cars); expect(outcomes[0].timeUs).toBe(outcomes[1].timeUs); expect(outcomes[0].result).toBe(outcomes[1].result);
    expect(outcomes[0].reason).toBe(defaults ? 1 : 2);
    if (!defaults) {
      expect(outcomes[0].timeUs).toBe(8000000);
      const hp = outcomes[0].cars.map((car: { hp: number }) => car.hp);
      expect(outcomes[0].result).toBe(hp[0] > hp[1] ? 0 : hp[1] > hp[0] ? 1 : 2);
      for (const page of pages) await expect(page.getByTestId('time-remaining')).toHaveText('Time remaining: 0.0 s');
    }
    records.push({ outcomes, final: await Promise.all(pages.map(read)) });
    for (let seat = 0; seat < 2; seat++) await info.attach(`result-${seat}.png`, { body: await pages[seat].screenshot({ fullPage: true }), contentType: 'image/png' });
    if (!defaults) {
      await pages[1].getByRole('button', { name: 'Return to Lobby', exact: true }).click();
      await expect(pages[0].getByLabel('Multiplayer mode')).toBeVisible();
      await pages[0].getByLabel('Multiplayer mode').selectOption('1');
      for (const page of pages) await expect(page.getByTestId('selected-mode')).toHaveText('Drag Race');
      await pages[0].getByLabel('Multiplayer mode').selectOption('2');
      for (const page of pages) await expect(page.getByTestId('selected-mode')).toHaveText('Road Rage');
      await start();
      const rematch = await Promise.all(pages.map(read)); records.push({ rematch });
      expect(rematch[0].roundId).toBeGreaterThan(initial[0].roundId);
      expect(rematch[0].seed).not.toBe(initial[0].seed);
      for (let seat = 0; seat < 2; seat++) {
        expect(rematch[seat].identity).toEqual(initial[seat].identity);
        expect(rematch[seat].cars.map((car: { hp: number }) => car.hp)).toEqual([6, 6]);
        await expect(pages[seat].getByTestId('nos-status')).toHaveText('NOS ready');
      }
      for (const page of pages) await expect(page.getByRole('heading', { name: 'Round result' })).toBeVisible({ timeout: 15000 });
    }
    expect(errors).toEqual([]);
    const final = await Promise.all(pages.map(read));
    for (const state of final) { expect(state.errors).toEqual([]); expect(state.verified).toBeGreaterThan(0); }
    const environments = await Promise.all(pages.map(page => page.evaluate(() => ({ userAgent: navigator.userAgent, width: innerWidth, height: innerHeight }))));
    await info.attach('road-rage.json', { body: JSON.stringify({ defaults, records, final, environments }), contentType: 'application/json' });
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
