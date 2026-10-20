import fs from "node:fs";
import path from "node:path";
import { expect } from "@playwright/test";
import { test } from "./evidence";

for (const resize of [false, true]) {
  test(`seeded high-speed contacts preserve exact HUD outcomes${resize ? " across resize" : ""}`, async ({
    page,
    evidence,
  }) => {
    await page.clock.install({ time: new Date("2026-10-14T19:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-14T19:00:01Z"));
    await page.goto("http://127.0.0.1:4173/tests/browser/track.html");
    await page.locator("canvas").click();
    await page.clock.runFor(3050);
    await page.keyboard.down("w");
    await page.clock.runFor(1050);
    if (resize) await page.setViewportSize({ width: 320, height: 600 });
    await page.screenshot({ path: path.join(evidence, "spawn-before-contact.png") });
    await page.clock.runFor(250);
    await expect(page.getByRole("img", { name: "Health: 3 of 4" })).toBeVisible();
    await page.screenshot({ path: path.join(evidence, "obstacle-consumed.png") });
    await page.clock.runFor(1000);
    await expect(page.getByRole("img", { name: "Health: 4 of 4" })).toBeVisible();
    await expect(page.getByText("Score: 0", { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(evidence, "heart-consumed.png") });
    const dimensions = await page
      .locator("canvas")
      .evaluate((c) => ({
        width: (c as HTMLCanvasElement).width,
        height: (c as HTMLCanvasElement).height,
      }));
    fs.writeFileSync(
      path.join(evidence, "track-observations.json"),
      JSON.stringify(
        {
          seed: 5410,
          generationVersion: 1,
          configurationVersion: 1,
          dimensions,
          resized: resize,
          acceleration: "held w, 4000 world units/s; spawn cadence 1 s",
          health: [4, 3, 4],
          score: 0,
          manualReview: "pending",
        },
        null,
        2,
      ),
    );
  });
}

test("seeded high-speed pickup adds exactly ten points", async ({ page, evidence }) => {
  await page.clock.install({ time: new Date("2026-10-14T19:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-14T19:00:01Z"));
  await page.goto("http://127.0.0.1:4173/tests/browser/track.html?coin");
  await page.locator("canvas").click();
  await page.clock.runFor(3050);
  await page.keyboard.down("w");
  await page.clock.runFor(1400);
  await expect(page.getByText("Score: 10", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Health: 2 of 2" })).toBeVisible();
  await page.keyboard.up("w");
  await page.keyboard.press("Space");
  await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(evidence, "boost-coin-paused.png") });
});
