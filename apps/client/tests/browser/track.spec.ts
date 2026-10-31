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
    const dimensions = await page.locator("canvas").evaluate((c) => ({
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

for (const height of [1440, 2160]) {
  test(`tall ${height}px screen preserves native artwork and top entry`, async ({ page }) => {
    await page.setViewportSize({ width: 606, height });
    await page.addInitScript(`(() => {
      const original = CanvasRenderingContext2D.prototype.drawImage;
      window.firstBarrierBottom = null;
      window.spriteSizes = [];
      CanvasRenderingContext2D.prototype.drawImage = function(...args) {
        const name = args[0]?.src?.split('/').at(-1);
        if (name === 'car.png' || name === 'barrier.png') {
          const m = this.getTransform();
          window.spriteSizes.push({ name, width: args[3] * Math.hypot(m.a, m.b),
            height: args[4] * Math.hypot(m.c, m.d) });
        }
        if (args[0]?.src?.endsWith('/barrier.png') && window.firstBarrierBottom === null)
          window.firstBarrierBottom = args[2] + args[4];
        return original.apply(this, args);
      };
    })()`);
    await page.clock.install({ time: new Date("2026-10-14T19:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-14T19:00:01Z"));
    await page.goto("http://127.0.0.1:4173/tests/browser/track.html");
    await page.locator("canvas").click();
    await page.clock.runFor(3050);
    await page.clock.runFor(1050);
    const bottom = await page.evaluate("window.firstBarrierBottom");
    expect(bottom).not.toBeNull();
    // First rendered frame may follow the exact spawn boundary by one frame.
    expect(bottom).toBeLessThanOrEqual(height * 0.02);
    const dimensions = await page.locator("canvas").evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const bounds = canvas.getBoundingClientRect();
      return {
        width: canvas.width,
        height: canvas.height,
        cssWidth: bounds.width,
        cssHeight: bounds.height,
      };
    });
    expect(dimensions.height).toBeLessThanOrEqual(806);
    expect(dimensions.cssWidth).toBeCloseTo(dimensions.width, 0);
    expect(dimensions.cssHeight).toBeCloseTo(dimensions.height, 0);
    const sprites = (await page.evaluate("window.spriteSizes")) as {
      name: string;
      width: number;
      height: number;
    }[];
    expect(sprites.some(({ name }) => name === "car.png")).toBe(true);
    expect(sprites.some(({ name }) => name === "barrier.png")).toBe(true);
    for (const sprite of sprites) {
      expect(sprite.width).toBeCloseTo(sprite.name === "car.png" ? 50 : 48, 8);
      expect(sprite.height).toBeCloseTo(sprite.name === "car.png" ? 80 : 40, 8);
    }
  });
}

test("tall Long Drive keeps constant obstacle speed until fully offscreen", async ({ page }) => {
  await page.setViewportSize({ width: 606, height: 2160 });
  await page.addInitScript(`(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    window.barrierMotion = [];
    let finished = false;
    CanvasRenderingContext2D.prototype.drawImage = function(...args) {
      const time = performance.now();
      if (args[0]?.src?.endsWith('/barrier.png') && !finished &&
          window.barrierMotion.at(-1)?.time !== time) {
        // The oldest obstacle is drawn first. Include the actual canvas transform.
        const transform = this.getTransform();
        const y = args[2] * transform.d + transform.f;
        const previous = window.barrierMotion.at(-1);
        // Once the oldest obstacle retires, the next one starts farther up.
        if (previous && y < previous.y) finished = true;
        else {
          window.barrierMotion.push({ time, y });
          finished = y >= this.canvas.height;
        }
      }
      return original.apply(this, args);
    };
  })()`);
  await page.clock.install({ time: new Date("2026-10-14T19:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-14T19:00:01Z"));
  await page.goto("http://127.0.0.1:4173/tests/browser/track.html");
  await page.locator("canvas").click();
  await page.clock.runFor(3050);
  await page.keyboard.down("ArrowLeft");
  await page.clock.runFor(100);
  await page.keyboard.up("ArrowLeft");
  await page.clock.runFor(3400);
  const height = await page.locator("canvas").evaluate((c) => (c as HTMLCanvasElement).height);
  const motion = (await page.evaluate("window.barrierMotion")) as { time: number; y: number }[];
  expect(motion.length).toBeGreaterThan(50);
  expect(motion[0].y).toBeLessThan(0);
  const velocities: number[] = [];
  for (let i = 1; i < motion.length; i++) {
    const previous = motion[i - 1];
    const current = motion[i];
    velocities.push((current.y - previous.y) / (current.time - previous.time));
  }
  const maxFrameTravel = Math.max(...motion.slice(1).map((frame, i) => frame.y - motion[i].y));
  // It can retire between frames, but never while more than one frame from exit.
  expect(motion.at(-1)!.y + maxFrameTravel).toBeGreaterThanOrEqual(height - 0.000001);
  for (const velocity of velocities) {
    expect(velocity).toBeGreaterThan(0);
    expect(velocity).toBeCloseTo(velocities[0], 6);
  }
});
