import { expect, test } from "@playwright/test";

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test("touch driving combines inputs, clears cancellation, and keeps settings off the race", async ({
  page,
  context,
}, testInfo) => {
  await page.clock.install();
  await page.goto("http://127.0.0.1:4173");
  await page.getByText("Long Drive", { exact: true }).click();
  await page.clock.runFor(5100);
  const accelerate = page.getByRole("button", { name: "Accelerate", exact: true });
  const left = page.getByRole("button", { name: "Steer left" });
  await expect(accelerate).toBeEnabled();
  await expect(page.getByRole("button", { name: "Restart" })).toHaveCount(0);
  const client = await context.newCDPSession(page);
  const center = async (locator: typeof left, id: number) => {
    const box = (await locator.boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, id };
  };
  const gas = await center(accelerate, 1),
    steering = await center(left, 2);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [gas] });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [gas, steering],
  });
  await page.clock.runFor(40);
  await expect(accelerate).toHaveAttribute("aria-pressed", "true");
  await expect(left).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".keyboard-hint")).toContainText("Accelerating!");
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [steering] });
  await expect(left).toHaveAttribute("aria-pressed", "false");
  await expect(accelerate).toHaveAttribute("aria-pressed", "true");
  await client.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await page.clock.runFor(20);
  await expect(accelerate).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".keyboard-hint")).not.toContainText("Accelerating!");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Game settings" })).toBeVisible();
  await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(accelerate).toBeEnabled();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 280, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      scrollbar: getComputedStyle(document.body).scrollbarWidth,
    }));
    expect(bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.height).toBeLessThanOrEqual(viewport.height);
    expect(bounds.scrollbar).toBe("none");
    await expect(accelerate).toBeInViewport();
    await expect(left).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`touch-${viewport.width}.png`) });
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.locator(".game-overlay")).toHaveText("3");
  await expect(accelerate).toBeDisabled();
});

test("short-screen menus remain reachable without scrollbar chrome", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 300 });
  await page.goto("http://127.0.0.1:4173");
  await page.getByText("Road Rage", { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText("Road Rage", { exact: true })).toBeInViewport();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth)).toBe(
    "none",
  );
});
