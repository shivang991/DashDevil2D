import { test, expect } from "@playwright/test";

test("match fits desktop, mobile and landscape; keyboard mute/menu work", async ({ page }) => {
  await page.route("**/__transport-config", (route) =>
    route.fulfill({ json: { server: "https://localhost" } }),
  );
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 664 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("http://127.0.0.1:4173/tests/browser/race-layout.html");
    await expect(page.getByTestId("time-remaining")).toHaveText("1:22");
    const canvas = page.getByRole("img", { name: "Multiplayer race" });
    const bounds = await canvas.boundingBox();
    expect(bounds!.height).toBeLessThanOrEqual(600);
    expect(bounds!.height).toBeGreaterThan(100);
    expect(bounds!.width / bounds!.height).toBeCloseTo(14 / 15, 2);
    expect(
      await page.evaluate(() => ({
        x: document.documentElement.scrollWidth > innerWidth,
        y: document.documentElement.scrollHeight > innerHeight,
      })),
    ).toEqual({ x: false, y: false });
    await expect(page.getByTestId("room-code")).toHaveCount(0);
    if (process.env.VITE_MULTIPLAYER_DEBUG === "true") {
      await page.getByText("Connection details", { exact: true }).click();
      await expect(page.getByTestId("room-evidence")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
        true,
      );
    } else {
      await expect(page.getByTestId("room-evidence")).toHaveCount(0);
    }
    await canvas.focus();
    const sound = page.getByRole("button", { name: /Sound/ });
    const before = await sound.textContent();
    await page.keyboard.press("m");
    await expect(sound).not.toHaveText(before!);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Race menu" })).toBeVisible();
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(canvas).toBeFocused();
    await page.screenshot({ path: `/tmp/multiplayer-layout-${viewport.width}.png` });
  }
  await page.goto("http://127.0.0.1:4173/tests/browser/race-layout.html?mode=1&offscreen&long");
  await expect(page.getByTestId("distance-remaining")).toContainText("% left");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/multiplayer-layout-drag.png" });
});
