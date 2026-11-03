import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:4173";

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 280, height: 568 },
]) {
  test(`compact Long Drive controls and fixed world at ${viewport.width}×${viewport.height}`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width !== 1280 });
    const page = await context.newPage();
    try {
      await page.clock.install();
      await page.goto(`${origin}/long-drive`);
      const canvas = page.locator("canvas");
      const pause = page.getByRole("button", { name: "Pause", exact: true });
      await expect(pause).toBeDisabled();
      const title = page.getByRole("heading", { name: "Long Drive", exact: true });
      await expect(title).toBeVisible();
      expect(await title.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      expect(
        await page
          .locator('img[src$="long-drive-logo.png"]')
          .evaluate((img) => (img as HTMLImageElement).naturalWidth),
      ).toBeGreaterThan(0);
      await page.clock.runFor(5100);
      await expect(pause).toBeEnabled();
      const dimensions = await canvas.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { width: element.width, height: element.height, ratio: rect.width / rect.height };
      });
      expect(dimensions.width).toBe(560);
      expect(dimensions.height).toBe(600);
      expect(dimensions.ratio).toBeCloseTo(14 / 15, 2);
      await page.screenshot({ path: testInfo.outputPath("playing.png") });
      await pause.click();
      const menu = page.getByRole("region", { name: "Game paused", exact: true });
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("button")).toHaveCount(3);
      const sound = menu.getByRole("button", { name: "Mute sound", exact: true });
      await sound.click();
      await expect(menu.getByRole("button", { name: "Enable sound", exact: true })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(menu).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("paused.png") });
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(menu).toHaveCount(0);
      await expect(canvas).toBeFocused();
      await page.keyboard.press("Space");
      await expect(menu).toBeVisible();
      await menu.getByRole("button", { name: "Resume", exact: true }).click();
      await expect(canvas).toBeFocused();
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await expect(menu).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await menu.getByRole("button", { name: "Restart", exact: true }).click();
      await expect(page.getByRole("status", { name: "Countdown", exact: true })).toHaveText("3");
      await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeDisabled();
    } finally {
      await context.close();
    }
  });
}

test("game over exposes restart and disables pause", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.5;
  });
  await page.clock.install();
  await page.goto(`${origin}/long-drive`);
  await page.clock.runFor(20000);
  const result = page.getByRole("region", { name: "Game over", exact: true });
  await expect(result).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeDisabled();
  await expect(result.getByRole("button", { name: "Back to Menu", exact: true })).toBeVisible();
  await result.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByRole("status", { name: "Countdown", exact: true })).toHaveText("3");
});
