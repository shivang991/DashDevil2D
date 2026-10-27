import { test, expect, type Page } from "@playwright/test";
import type { PairedState } from "../../src/transport/PairedConnection";
const read = async (page: Page) =>
  JSON.parse((await page.getByTestId("room-evidence").textContent())!) as PairedState;
const hearts = Boolean(process.env.DASHDEVIL_HEART_TESTS);
test(
  hearts
    ? "two actual browsers collect and deny reserved hearts and confirm finish"
    : "two actual browsers survive shipped default objects until HP elimination",
  async ({ browser, baseURL }, info) => {
    test.setTimeout(90000);
    const contexts = await Promise.all([
      browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } }),
      browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } }),
    ]);
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    const observations: PairedState[][] = [];
    try {
      for (const page of pages) {
        await page.goto("/");
        await page.getByRole("button", { name: /Drag Race/ }).click();
      }
      await pages[0].getByRole("button", { name: "Create Room", exact: true }).click();
      await expect(pages[0].getByTestId("connection-state")).toHaveText("Connected");
      const code = await pages[0].getByTestId("room-code").innerText();
      await pages[1].getByRole("button", { name: "Join Room", exact: true }).click();
      await pages[1].getByLabel("Room code").fill(code);
      await pages[1].getByRole("button", { name: "Join Room", exact: true }).click();
      await expect(pages[1].getByTestId("connection-state")).toHaveText("Connected");
      for (const page of pages)
        await page.getByRole("button", { name: "Ready", exact: true }).click();
      await pages[0].getByRole("button", { name: "Start round" }).click();
      for (const page of pages)
        await expect(page.getByRole("img", { name: "Multiplayer race" })).toBeVisible();
      const initial = await read(pages[0]);
      expect(initial.context?.gameplay.finishDistance).toBe(hearts ? 2400 : 24000);
      expect(initial.context?.gameplay.reservedHearts).toBe(hearts ? 2 : 4);
      if (hearts) {
        // Steer both cars into the first server-published reserved heart lane. No
        // timing fixture or state mutation; both continue at the same normal speed.
        await expect
          .poll(async () =>
            (await read(pages[0])).objects?.some((object) => (object.flags & 3) === 3),
          )
          .toBe(true);
        const heart = (await read(pages[0])).objects!.find((object) => (object.flags & 3) === 3)!;
        // Car blocking forbids co-located cars. Only one legal collector enters
        // the heart lane; both browsers must observe its full-health denial.
        const seat = heart.lane === 2 ? 1 : 0;
        const page = pages[seat],
          lane = seat === 0 ? 0 : 2;
        if (lane !== heart.lane) {
          await page.getByRole("img", { name: "Multiplayer race" }).focus();
          await page.keyboard.press(heart.lane > lane ? "ArrowRight" : "ArrowLeft");
          await expect
            .poll(
              async () => {
                const car = (await read(page)).cars?.[seat];
                return car?.phase === 0 ? car.lane : -1;
              },
              { intervals: [20], timeout: 1500 },
            )
            .toBe(heart.lane);
        }
        await expect
          .poll(async () => (await read(pages[0])).cars?.[0].progress ?? 0, { intervals: [20] })
          .toBeGreaterThanOrEqual(600);
        await info.attach("reserved-heart-visible.png", {
          body: await pages[0].screenshot({ fullPage: true }),
          contentType: "image/png",
        });
        await expect
          .poll(
            async () =>
              (await read(pages[0])).objects?.find((object) => object.id === heart.id)?.flags,
            { intervals: [20], timeout: 4000 },
          )
          .toBe(7);
        const collected = await Promise.all(pages.map(read));
        observations.push(collected);
        expect(collected[0].cars?.map((car) => car.hp)).toEqual([3, 3]);
        await info.attach("shared-heart.png", {
          body: await pages[0].screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      } else {
        await expect
          .poll(async () => (await read(pages[0])).cars?.[0].progress ?? 0, { intervals: [20] })
          .toBeGreaterThanOrEqual(1000);
        await info.attach("default-obstacle-visible.png", {
          body: await pages[0].screenshot({ fullPage: true }),
          contentType: "image/png",
        });
        await expect
          .poll(async () => (await read(pages[0])).cars?.some((car) => car.hp < 3), {
            timeout: 20000,
          })
          .toBe(true);
        observations.push(await Promise.all(pages.map(read)));
        await info.attach("default-course-hit.png", {
          body: await pages[0].screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      }
      for (const page of pages)
        await expect(page.getByRole("heading", { name: "Round Over" })).toBeVisible({
          timeout: 65000,
        });
      const outcomes = await Promise.all(
        pages.map((page) =>
          page
            .getByTestId("outcome-evidence")
            .textContent()
            .then((value) => JSON.parse(value!)),
        ),
      );
      expect(outcomes[0].reason).toBe(hearts ? 0 : 1);
      expect(outcomes[0].result).toBe(outcomes[1].result);
      expect(outcomes[0].timeUs).toBe(outcomes[1].timeUs);
      expect(outcomes[0].cars).toEqual(outcomes[1].cars);
      if (!hearts) expect(outcomes[0].cars.some((car: { hp: number }) => car.hp === 0)).toBe(true);
      observations.push(await Promise.all(pages.map(read)));
      for (const state of observations.at(-1)!) {
        expect(state.errors).toEqual([]);
        expect(state.verified).toBeGreaterThan(0);
      }
      const environments = await Promise.all(
        pages.map((page) =>
          page.evaluate(() => ({
            userAgent: navigator.userAgent,
            width: innerWidth,
            height: innerHeight,
          })),
        ),
      );
      await info.attach("objects.json", {
        body: JSON.stringify({ hearts, outcomes, observations, environments }),
        contentType: "application/json",
      });
      for (let seat = 0; seat < 2; seat++)
        await info.attach(`result-${seat}.png`, {
          body: await pages[seat].screenshot({ fullPage: true }),
          contentType: "image/png",
        });
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  },
);
