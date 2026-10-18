import { test, expect, type Page } from '@playwright/test';
const evidence = async (page: Page) => JSON.parse((await page.getByTestId('room-evidence').textContent())!);

test('idle warning, explicit expiry failure, fresh room, reserved host and expiry transfer', async ({ browser, baseURL }, info) => {
  const contexts = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const errors: string[] = [];
  const records: unknown[] = [];
  for (const page of pages) page.on('pageerror', error => errors.push(error.message));
  try {
    for (const page of pages) { await page.goto('/'); await page.getByRole('button', { name: /Drag Race/ }).click(); }
    await pages[0].getByRole('button', { name: 'Create Room', exact: true }).click();
    await expect(pages[0].getByTestId('connection-state')).toHaveText('Connected');
    const original = await evidence(pages[0]); records.push({ original });
    await expect(pages[0].getByText('This room will expire soon without activity.')).toBeVisible();
    await info.attach('idle-warning.png', { body: await pages[0].screenshot(), contentType: 'image/png' });
    await expect(pages[0].getByRole('alert').filter({ hasText: 'Room expired' })).toBeVisible({ timeout: 5000 });
    await expect(pages[0].getByRole('button', { name: 'Create Room', exact: true })).toBeEnabled();
    await expect(pages[0].getByRole('heading', { name: 'Round result' })).toHaveCount(0);
    await info.attach('idle-expired.png', { body: await pages[0].screenshot(), contentType: 'image/png' });
    await pages[0].getByRole('button', { name: 'Create Room', exact: true }).click();
    await expect(pages[0].getByTestId('connection-state')).toHaveText('Connected');
    const code = await pages[0].getByTestId('room-code').innerText();
    await pages[1].getByLabel('Room code').fill(code); await pages[1].getByRole('button', { name: 'Join Room', exact: true }).click();
    await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected');
    const before = await evidence(pages[1]); records.push({ before });
    // Hold both native transports closed on reload; the reserved host must not transfer early.
    await contexts[0].route('**/admission*', route => route.abort());
    await pages[0].reload();
    await expect(pages[1].getByText(/Host · Reconnecting/)).toBeVisible();
    await expect(pages[1].getByLabel('Multiplayer mode')).toHaveCount(0);
    // A real readiness change resets the 2s idle window, allowing grace to expire first.
    await pages[1].getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(pages[1].getByRole('button', { name: 'Cancel ready', exact: true })).toBeVisible();
    await pages[1].getByRole('button', { name: 'Cancel ready', exact: true }).click();
    await expect(pages[1].getByLabel('Multiplayer mode')).toBeVisible({ timeout: 4000 });
    await expect(pages[1].getByText('Waiting for player')).toBeVisible();
    records.push({ transferred: await evidence(pages[1]) });
    await info.attach('host-transferred.png', { body: await pages[1].screenshot(), contentType: 'image/png' });
    expect(errors).toEqual([]);
  } finally {
    await info.attach('boundaries.json', { body: JSON.stringify({ records, errors }), contentType: 'application/json' });
    await Promise.all(contexts.map(context => context.close()));
  }
});

test('countdown and gameplay outlive idle expiry; leaving a disconnected opponent confirms abandonment on recovery', async ({ browser, baseURL }, info) => {
  test.setTimeout(30000);
  const contexts = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const records: unknown[] = [];
  const errors: string[] = [];
  for (const page of pages) page.on('pageerror', error => errors.push(error.message));
  try {
    for (const page of pages) { await page.goto('/'); await page.getByRole('button', { name: /Drag Race/ }).click(); }
    await pages[0].getByRole('button', { name: 'Create Room', exact: true }).click();
    await expect(pages[0].getByTestId('connection-state')).toHaveText('Connected');
    const code = await pages[0].getByTestId('room-code').innerText();
    await pages[1].getByLabel('Room code').fill(code); await pages[1].getByRole('button', { name: 'Join Room', exact: true }).click();
    await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected');
    for (const page of pages) await page.getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(pages[0].getByRole('button', { name: 'Start round' })).toBeEnabled();
    await pages[0].getByRole('button', { name: 'Start round' }).click();
    for (const page of pages) await expect(page.getByRole('img', { name: 'Multiplayer race' })).toBeVisible();
    await expect.poll(async () => (await evidence(pages[0])).timeUs).toBeGreaterThan(2100000);
    records.push({ active: await Promise.all(pages.map(evidence)) });
    // Block replacement admission while the guest's page disconnects, then restore
    // it before the two-second grace. This is transport loss, not OS suspension.
    await contexts[1].route('**/admission*', route => route.abort());
    await pages[1].reload();
    await expect(pages[0].getByText('Opponent disconnected—round continues.')).toBeVisible();
    await pages[0].getByRole('button', { name: 'Leave', exact: true }).click();
    await expect(pages[0].getByText('Leaving abandons this round while the opponent is disconnected.')).toBeVisible();
    await pages[0].getByRole('button', { name: 'Confirm leave', exact: true }).click();
    await expect(pages[0].getByRole('button', { name: 'Create Room', exact: true })).toBeVisible();
    await contexts[1].unroute('**/admission*'); await pages[1].reload();
    await pages[1].getByRole('button', { name: /Drag Race/ }).click();
    await expect(pages[1].getByRole('heading', { name: 'Round result' })).toBeVisible();
    const outcome = JSON.parse((await pages[1].getByTestId('outcome-evidence').textContent())!);
    expect(outcome.result).toBe(3); expect(outcome.reason).toBe(5);
    records.push({ recovered: await evidence(pages[1]), outcome });
    await info.attach('confirmed-abandonment.png', { body: await pages[1].screenshot(), contentType: 'image/png' });
    expect(errors).toEqual([]);
  } finally {
    await info.attach('abandonment.json', { body: JSON.stringify({ records, errors }), contentType: 'application/json' });
    await Promise.all(contexts.map(context => context.close()));
  }
});
