import { test, expect } from '@playwright/test';

test('two React participants adopt host mode, ready and share a physics-free countdown and round zero', async ({ browser, baseURL }, info) => {
  const contexts = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const page of pages) {
      await page.addInitScript(() => localStorage.setItem('dashdevil-local-name', 'Same Driver'));
      await page.goto('/');
      await expect(page.getByText('Same Driver', { exact: true })).toBeVisible();
    }
    await pages[0].getByRole('button', { name: /Road Rage/ }).click();
    await pages[0].getByRole('button', { name: 'Create Room', exact: true }).click();
    await expect(pages[0].getByTestId('connection-state')).toHaveText('Connected');
    const code = await pages[0].getByTestId('room-code').innerText();
    expect(code).toMatch(/^\d{4}$/);
    await pages[1].getByRole('button', { name: /Drag Race/ }).click();
    await pages[1].getByLabel('Room code').fill(code);
    await pages[1].getByLabel('Room code').press('Enter');
    await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected');
    await expect(pages[1].getByTestId('selected-mode')).toHaveText('Road Rage');
    for (const page of pages) await expect(page.getByText('Same Driver (You)', { exact: true })).toBeVisible();
    await expect(pages[1].getByLabel('Multiplayer mode')).toHaveCount(0);
    await pages[0].getByRole('button', { name: 'Ready', exact: true }).click();
    await pages[1].getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(pages[0].getByRole('button', { name: 'Start round' })).toBeEnabled();
    await pages[0].getByRole('button', { name: 'Start round' }).click();
    await expect(pages[1].getByTestId('countdown')).toBeVisible();
    // Platform visibility fixture: real UI and transport handling; this is not
    // evidence of OS/browser background-tab scheduling or supported-release coverage.
    await pages[1].evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    for (const page of pages) {
      await expect(page.getByText('Countdown cancelled. Both players must ready again.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ready', exact: true })).toBeVisible();
    }
    await pages[1].evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await pages[0].getByRole('button', { name: 'Ready', exact: true }).click();
    await pages[1].getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(pages[0].getByRole('button', { name: 'Start round' })).toBeEnabled();
    await pages[0].getByRole('button', { name: 'Start round' }).click();
    for (const page of pages) {
      await expect(page.getByTestId('countdown')).toContainText(/3|2|1/);
      await page.keyboard.press('ArrowUp');
      await expect(page.getByTestId('round-time')).toHaveText('0');
    }
    for (const page of pages) await expect(page.getByRole('heading', { name: 'Round ready' })).toBeVisible();
    const evidence = await Promise.all(pages.map(page => page.getByTestId('room-evidence').textContent().then(value => JSON.parse(value!))));
    expect(evidence[0].startUs).toBe(evidence[1].startUs);
    expect(evidence[0].roundId).toBe(evidence[1].roundId);
    expect(evidence[0].cars).toEqual(evidence[1].cars);
    for (let i = 0; i < pages.length; i++) {
      expect(evidence[i].timeUs).toBe(0);
      expect(evidence[i].cars.map((car: { progress: number; heldMask: number; effective: number }) => [car.progress, car.heldMask, car.effective])).toEqual([[0, 0, 0], [0, 0, 0]]);
      await info.attach(`room-seat-${i}.json`, { body: JSON.stringify({ ...evidence[i], browser: await pages[i].evaluate(() => navigator.userAgent) }), contentType: 'application/json' });
      await info.attach(`room-seat-${i}.png`, { body: await pages[i].screenshot(), contentType: 'image/png' });
    }
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('four-digit entry retains leading zeros and shows admission errors beside the native form', async ({ page }) => {
  let submitted = '';
  page.on('request', request => {
    if (request.url().endsWith('/admission')) {
      // Inspect the actual binary request's literal room-code section, not a UI-only value.
      const bytes = request.postDataBuffer();
      if (bytes) submitted = bytes.subarray(12, 16).toString();
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Drag Race/ }).click();
  await page.getByLabel('Room code').fill('0042');
  await page.getByLabel('Room code').press('Enter');
  await expect(page.getByRole('alert').first()).toContainText('Room not found');
  await expect(page.getByLabel('Room code')).toHaveValue('0042');
  expect(submitted).toBe('0042');
});

test('storage denial retains one local name across entry, admission and return', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage denied'); } }); });
  await page.goto('/');
  const name = await page.locator('p').filter({ hasText: /^Driver / }).innerText();
  await page.getByRole('button', { name: /Road Rage/ }).click();
  await page.getByRole('button', { name: 'Create Room', exact: true }).click();
  await expect(page.getByText(`${name} (You)`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
});

test('host mode changes clear readiness and a reloaded tab recovers its authenticated seat', async ({ browser, baseURL }, info) => {
  const contexts = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const page of pages) { await page.goto('/'); await page.getByRole('button', { name: /Drag Race/ }).click(); }
    await pages[0].getByRole('button', { name: 'Create Room', exact: true }).click();
    await expect(pages[0].getByTestId('connection-state')).toHaveText('Connected');
    const code = await pages[0].getByTestId('room-code').innerText();
    await pages[1].getByLabel('Room code').fill(code);
    await pages[1].getByRole('button', { name: 'Join Room', exact: true }).click();
    await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected');
    for (const page of pages) await page.getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(pages[0].getByRole('button', { name: 'Start round' })).toBeEnabled();
    await pages[0].getByLabel('Multiplayer mode').selectOption('2');
    for (const page of pages) {
      await expect(page.getByTestId('selected-mode')).toHaveText('Road Rage');
      await expect(page.getByRole('button', { name: 'Ready', exact: true })).toBeVisible();
    }
    const original = JSON.parse((await pages[1].getByTestId('room-evidence').textContent())!).identity;
    await pages[1].reload();
    await pages[1].getByRole('button', { name: /Drag Race/ }).click();
    await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected');
    await expect(pages[1].getByTestId('room-code')).toHaveText(code);
    const recovered = JSON.parse((await pages[1].getByTestId('room-evidence').textContent())!).identity;
    expect(recovered.seatSession).toBe(original.seatSession);
    expect(recovered.pairGeneration).toBeGreaterThan(original.pairGeneration);
    for (const page of pages) await page.getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(pages[0].getByRole('button', { name: 'Start round' })).toBeEnabled();
    await pages[0].getByRole('button', { name: 'Start round' }).click();
    await expect(pages[0].getByTestId('countdown')).toBeVisible();
    await pages[0].getByRole('button', { name: 'Leave', exact: true }).click();
    await expect(pages[0].getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await pages[0].getByRole('button', { name: 'Cancel', exact: true }).press('Escape');
    await expect(pages[0].getByRole('dialog')).toHaveCount(0);
    await pages[0].getByRole('button', { name: 'Leave', exact: true }).click();
    await pages[0].getByRole('button', { name: 'Confirm leave', exact: true }).click();
    await expect(pages[1].getByText('Countdown cancelled. Both players must ready again.')).toBeVisible();
    await expect(pages[1].getByLabel('Multiplayer mode')).toBeVisible();
    await info.attach('recovery-identities.json', { body: JSON.stringify({ original, recovered }), contentType: 'application/json' });
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
