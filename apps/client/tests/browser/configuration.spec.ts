import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { test } from './evidence';

// Independently derived timeline from #16: HP starts at 4, an obstacle removes
// one, an optional heart restores exactly one, score remains zero. Platform
// randomness changes object selection without changing active configuration.
test('developer capture drives actual Long Drive HP HUD, heart drawing, healing and audio', async ({ page, evidence }) => {
  // Seed 5410 draws middle obstacle, then middle heart.
  await page.addInitScript(() => { Math.random = () => (5410 - .5) / 0xffffffff; });
  await page.addInitScript(() => {
    const Audio = window.AudioContext;
    let notes = 0;
    if (Audio) {
      const original = Audio.prototype.createOscillator;
      Audio.prototype.createOscillator = function () { notes++; return original.call(this); };
    }
    Object.assign(window, { recordedNotes: () => notes });
  });
  await page.clock.install({ time: new Date('2026-10-14T19:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-14T19:00:01Z'));
  await page.goto('http://127.0.0.1:4173/tests/browser/configuration.html');
  await expect(page.locator('.game-overlay')).toHaveText('3');
  await expect(page.getByRole('img', { name: 'Health: 4 of 4' })).toBeVisible();
  await page.locator('canvas').click();
  await page.clock.runFor(3050);
  await page.clock.runFor(2900);
  await expect(page.getByRole('img', { name: 'Health: 3 of 4' })).toBeVisible();
  await page.clock.runFor(500);
  await expect(page.getByRole('img', { name: 'Health: 3 of 4' })).toBeVisible();
  await page.screenshot({ path: path.join(evidence, 'override-heart-before-contact.png') });
  const before = await page.evaluate('recordedNotes()') as number;
  await page.clock.runFor(500);
  await expect(page.getByRole('img', { name: 'Health: 4 of 4' })).toBeVisible();
  expect(await page.evaluate('recordedNotes()')).toBeGreaterThan(before);
  await expect(page.getByText('Score: 0', { exact: true })).toBeVisible();
  await page.evaluate('window.configurationOverride.gameplay.maxHealth = 2');
  await page.clock.runFor(1500);
  await expect(page.getByRole('img', { name: 'Health: 4 of 4' })).toBeVisible();
  await page.screenshot({ path: path.join(evidence, 'override-heart-healed.png') });
  fs.writeFileSync(path.join(evidence, 'override-observations.json'), JSON.stringify({ configurationVersion: 1, fixtureVersion: 1, maximumHP: 4, damageHP: 3, healedHP: 4, finalScore: 0, randomness: 'xorshift32 seed 5410', heartAudio: 'oscillator cue observed; human audition pending', heartRendering: 'screenshot retained; human comparison pending', activeOverrideMutation: 'HUD remains captured at 4' }, null, 2));
});
