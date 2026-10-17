# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rooms.spec.ts >> two React participants adopt host mode, ready and share a physics-free countdown and round zero
- Location: tests/browser/rooms.spec.ts:3:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: getByTestId('connection-state')
Expected: "Connected"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveText" getByTestId('connection-state') with timeout 5000ms
  - waiting for getByTestId('connection-state')

```

```yaml
- main:
  - heading "Drag Race" [level=1]
  - paragraph: Same Driver
  - paragraph: Create a private room or join a friend.
  - button "Create Room"
  - text: Room code
  - textbox "Room code": "1206"
  - button "Join Room"
  - alert
  - button "Back"
- button "Mute sound" [pressed]: Sound on
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test('two React participants adopt host mode, ready and share a physics-free countdown and round zero', async ({ browser, baseURL }, info) => {
  4   |   const contexts = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })]);
  5   |   const pages = await Promise.all(contexts.map(context => context.newPage()));
  6   |   try {
  7   |     for (const page of pages) {
  8   |       await page.addInitScript(() => localStorage.setItem('dashdevil-local-name', 'Same Driver'));
  9   |       await page.goto('/');
  10  |       await expect(page.getByText('Same Driver', { exact: true })).toBeVisible();
  11  |     }
  12  |     await pages[0].getByRole('button', { name: /Road Rage/ }).click();
  13  |     await pages[0].getByRole('button', { name: 'Create Room', exact: true }).click();
  14  |     await expect(pages[0].getByTestId('connection-state')).toHaveText('Connected');
  15  |     const code = await pages[0].getByTestId('room-code').innerText();
  16  |     expect(code).toMatch(/^\d{4}$/);
  17  |     await pages[1].getByRole('button', { name: /Drag Race/ }).click();
  18  |     await pages[1].getByLabel('Room code').fill(code);
  19  |     await pages[1].getByLabel('Room code').press('Enter');
> 20  |     await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected');
      |                                                            ^ Error: expect(locator).toHaveText(expected) failed
  21  |     await expect(pages[1].getByTestId('selected-mode')).toHaveText('Road Rage');
  22  |     for (const page of pages) await expect(page.getByText('Same Driver (You)', { exact: true })).toBeVisible();
  23  |     await expect(pages[1].getByLabel('Multiplayer mode')).toHaveCount(0);
  24  |     await info.attach('lobby.png', { body: await pages[0].screenshot(), contentType: 'image/png' });
  25  |     await pages[0].getByRole('button', { name: 'Ready', exact: true }).click();
  26  |     await pages[1].getByRole('button', { name: 'Ready', exact: true }).click();
  27  |     await expect(pages[0].getByRole('button', { name: 'Start round' })).toBeEnabled();
  28  |     await pages[0].getByRole('button', { name: 'Start round' }).click();
  29  |     await expect(pages[1].getByTestId('countdown')).toBeVisible();
  30  |     await expect(pages[0].getByTestId('countdown')).toBeVisible();
  31  |     await info.attach('countdown.png', { body: await pages[0].screenshot(), contentType: 'image/png' });
  32  |     // Platform visibility fixture: real UI and transport handling; this is not
  33  |     // evidence of OS/browser background-tab scheduling or supported-release coverage.
  34  |     await pages[1].evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  35  |     for (const page of pages) {
  36  |       await expect(page.getByText('Countdown cancelled. Both players must ready again.')).toBeVisible();
  37  |       await expect(page.getByRole('button', { name: 'Ready', exact: true })).toBeVisible();
  38  |     }
  39  |     await pages[1].evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  40  |     await pages[0].getByRole('button', { name: 'Ready', exact: true }).click();
  41  |     await pages[1].getByRole('button', { name: 'Ready', exact: true }).click();
  42  |     await expect(pages[0].getByRole('button', { name: 'Start round' })).toBeEnabled();
  43  |     await pages[0].getByRole('button', { name: 'Start round' }).click();
  44  |     for (const page of pages) {
  45  |       await expect(page.getByTestId('countdown')).toContainText(/3|2|1/);
  46  |       await page.keyboard.press('ArrowUp');
  47  |       await expect(page.getByTestId('round-time')).toHaveText('0');
  48  |     }
  49  |     for (const page of pages) {
  50  |       await expect(page.getByRole('heading', { name: 'Round ready' })).toBeVisible();
  51  |       await expect(page.getByText('Countdown cancelled. Both players must ready again.')).toHaveCount(0);
  52  |     }
  53  |     const evidence = await Promise.all(pages.map(page => page.getByTestId('room-evidence').textContent().then(value => JSON.parse(value!))));
  54  |     expect(evidence[0].startUs).toBe(evidence[1].startUs);
  55  |     expect(evidence[0].roundId).toBe(evidence[1].roundId);
  56  |     expect(evidence[0].cars).toEqual(evidence[1].cars);
  57  |     for (let i = 0; i < pages.length; i++) {
  58  |       expect(evidence[i].timeUs).toBe(0);
  59  |       expect(evidence[i].cars.map((car: { progress: number; heldMask: number; effective: number }) => [car.progress, car.heldMask, car.effective])).toEqual([[0, 0, 0], [0, 0, 0]]);
  60  |       await info.attach(`room-seat-${i}.json`, { body: JSON.stringify({ ...evidence[i], browser: await pages[i].evaluate(() => navigator.userAgent) }), contentType: 'application/json' });
  61  |       await info.attach(`room-seat-${i}.png`, { body: await pages[i].screenshot(), contentType: 'image/png' });
  62  |     }
  63  |   } finally { await Promise.all(contexts.map(context => context.close())); }
  64  | });
  65  | 
  66  | test('four-digit entry retains leading zeros and shows admission errors beside the native form', async ({ page }) => {
  67  |   let submitted = '';
  68  |   page.on('request', request => {
  69  |     if (request.url().endsWith('/admission')) {
  70  |       // Inspect the actual binary request's literal room-code section, not a UI-only value.
  71  |       const bytes = request.postDataBuffer();
  72  |       if (bytes) submitted = bytes.subarray(12, 16).toString();
  73  |     }
  74  |   });
  75  |   await page.goto('/');
  76  |   await page.getByRole('button', { name: /Drag Race/ }).click();
  77  |   await page.getByLabel('Room code').fill('0042');
  78  |   await page.getByLabel('Room code').press('Enter');
  79  |   await expect(page.getByRole('alert').first()).toContainText('Room not found');
  80  |   await expect(page.getByLabel('Room code')).toHaveValue('0042');
  81  |   expect(submitted).toBe('0042');
  82  | });
  83  | 
  84  | test('storage denial retains one local name across entry, admission and return', async ({ page }) => {
  85  |   await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage denied'); } }); });
  86  |   await page.goto('/');
  87  |   const name = await page.locator('p').filter({ hasText: /^Driver / }).innerText();
  88  |   await page.getByRole('button', { name: /Road Rage/ }).click();
  89  |   await page.getByRole('button', { name: 'Create Room', exact: true }).click();
  90  |   await expect(page.getByText(`${name} (You)`, { exact: true })).toBeVisible();
  91  |   await page.getByRole('button', { name: 'Leave', exact: true }).click();
  92  |   await expect(page.getByText(name, { exact: true })).toBeVisible();
  93  |   await page.getByRole('button', { name: 'Back', exact: true }).click();
  94  |   await expect(page.getByText(name, { exact: true })).toBeVisible();
  95  | });
  96  | 
  97  | test('host mode changes clear readiness and a reloaded tab recovers its authenticated seat', async ({ browser, baseURL }, info) => {
  98  |   const contexts = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })]);
  99  |   const pages = await Promise.all(contexts.map(context => context.newPage()));
  100 |   try {
  101 |     for (const page of pages) { await page.goto('/'); await page.getByRole('button', { name: /Drag Race/ }).click(); }
  102 |     await pages[0].getByRole('button', { name: 'Create Room', exact: true }).click();
  103 |     await expect(pages[0].getByTestId('connection-state')).toHaveText('Connected');
  104 |     const code = await pages[0].getByTestId('room-code').innerText();
  105 |     await pages[1].getByLabel('Room code').fill(code);
  106 |     await pages[1].getByRole('button', { name: 'Join Room', exact: true }).click();
  107 |     await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected');
  108 |     for (const page of pages) await page.getByRole('button', { name: 'Ready', exact: true }).click();
  109 |     await expect(pages[0].getByRole('button', { name: 'Start round' })).toBeEnabled();
  110 |     await pages[0].getByLabel('Multiplayer mode').selectOption('2');
  111 |     for (const page of pages) {
  112 |       await expect(page.getByTestId('selected-mode')).toHaveText('Road Rage');
  113 |       await expect(page.getByRole('button', { name: 'Ready', exact: true })).toBeVisible();
  114 |     }
  115 |     const original = JSON.parse((await pages[1].getByTestId('room-evidence').textContent())!).identity;
  116 |     await pages[1].reload();
  117 |     await pages[1].getByRole('button', { name: /Drag Race/ }).click();
  118 |     await expect(pages[1].getByTestId('connection-state')).toHaveText('Connected');
  119 |     await expect(pages[1].getByTestId('room-code')).toHaveText(code);
  120 |     const recovered = JSON.parse((await pages[1].getByTestId('room-evidence').textContent())!).identity;
```