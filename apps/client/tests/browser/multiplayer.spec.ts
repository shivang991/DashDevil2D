import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { test } from './evidence';

test('actual browser executes next-tick NOS and shift diagnostics with independent sessions', async ({ page, evidence }) => {
 await page.goto('http://127.0.0.1:4173/tests/browser/multiplayer.html');
 await expect(page.locator('#state')).toContainText('"tick":0');
 const observations = await page.evaluate(`(() => {
  advance(.1); command(1, 0, 3, 4); const boost = advance(.2);
  command(2, 0, 2, 6); const shift = advance(.3);
  const other = independent.snapshot();
  return { boost, shift, other };
 })()`);
 expect(observations.boost.events[0]).toMatchObject({ type: 'input', tick: 6, timeUs: 100000, disposition: 'accepted' });
 expect(observations.boost.state.cars[0].progress).toBeCloseTo(120, 6);
 expect(observations.shift.state.cars[0].progress).toBeCloseTo(160, 6);
 expect(observations.shift.state.cars[0].lateral).toBeCloseTo(-40, 6);
 expect(observations.shift.state.cars[0].effective).toBe(2);
 expect(observations.other.cars[0].progress).toBe(0);
 await page.screenshot({ path: path.join(evidence, 'multiplayer-mechanics.png') });
 fs.writeFileSync(path.join(evidence, 'multiplayer-observations.json'), JSON.stringify({ ...observations, scope: 'Headless mechanics loaded by actual Chrome, diagnostic canvas only. No transport, multiplayer UI or screen-visible timing acceptance claimed.' }, null, 2));
});
