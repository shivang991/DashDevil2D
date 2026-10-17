import { test, expect } from '@playwright/test';

test('two actual browsers predict NOS and steering, then display one confirmed front-edge result', async ({ browser, baseURL }, info) => {
  test.setTimeout(45000);
  const contexts = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })]);
  const pages = await Promise.all(contexts.map(c => c.newPage()));
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
    for (const page of pages) { await expect(page.getByTestId('countdown')).toBeVisible(); await page.keyboard.press('ArrowUp'); }
    for (const page of pages) await expect(page.getByRole('heading', { name: 'Drag Race', exact: true })).toBeVisible();
    const canvas = pages[0].getByRole('img', { name: 'Multiplayer race' });
    await expect(canvas).toBeVisible(); await canvas.focus();
    await pages[0].keyboard.down('ArrowUp');
    await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS active');
    await pages[0].keyboard.down('ArrowRight');
    await expect(pages[0].getByTestId('nos-status')).toHaveText('NOS ready');
    await pages[0].keyboard.up('ArrowRight'); await pages[0].keyboard.up('ArrowUp');
    await pages[0].keyboard.down('ArrowUp');
    await info.attach('race.png', { body: await pages[0].screenshot(), contentType: 'image/png' });
    for (const page of pages) await expect(page.getByRole('heading', { name: 'Round result' })).toBeVisible({ timeout: 15000 });
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
    await info.attach('outcomes.json', { body: JSON.stringify({ outcomes, evidence }), contentType: 'application/json' });
    for (let i = 0; i < pages.length; i++) await info.attach(`result-${i}.png`, { body: await pages[i].screenshot(), contentType: 'image/png' });
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
