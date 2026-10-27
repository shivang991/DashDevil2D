import { test, expect, type Page } from "@playwright/test";
import type { PairedState } from "../../src/transport/PairedConnection";
const read = async (page: Page) =>
  JSON.parse((await page.getByTestId("room-evidence").textContent())!) as PairedState;
for (const leader of [0, 1])
  test(`two browsers return, overtake and release tailgating (leader seat ${leader})`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(60000);
    const contexts = await Promise.all(
      [0, 1].map(() => browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } })),
    );
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    const samples: PairedState[][] = [];
    const follower = 1 - leader;
    const towardMiddle = (seat: number) => (seat === 0 ? "ArrowRight" : "ArrowLeft");
    const outward = (seat: number) => (seat === 0 ? "ArrowLeft" : "ArrowRight");
    try {
      for (const page of pages) {
        await page.goto("/");
        await page.getByRole("button", { name: /Drag Race/ }).click();
      }
      await pages[0].getByRole("button", { name: "Create Room", exact: true }).click();
      await expect(pages[0].getByTestId("connection-state")).toHaveText("Connected");
      await pages[1].getByRole("button", { name: "Join Room", exact: true }).click();
      await pages[1]
        .getByLabel("Room code")
        .fill(await pages[0].getByTestId("room-code").innerText());
      await pages[1].getByRole("button", { name: "Join Room", exact: true }).click();
      await expect(pages[1].getByTestId("connection-state")).toHaveText("Connected");
      for (const page of pages)
        await page.getByRole("button", { name: "Ready", exact: true }).click();
      await pages[0].getByRole("button", { name: "Start round" }).click();
      for (const page of pages)
        await expect(page.getByRole("img", { name: "Multiplayer race" })).toBeVisible();
      // Observe authority without injecting or modifying gameplay state.
      for (const page of pages)
        await page.evaluate(() => {
          const observations: unknown[] = [];
          Object.assign(window, { contactObservations: observations });
          setInterval(() => {
            const text = document.querySelector('[data-testid="room-evidence"]')?.textContent;
            if (text && observations.length < 3000) observations.push(JSON.parse(text));
          }, 10);
        });
      for (const page of pages) await page.getByRole("img", { name: "Multiplayer race" }).focus();
      await Promise.all(pages.map((page, seat) => page.keyboard.press(towardMiddle(seat))));
      await expect
        .poll(async () => (await read(pages[0])).cars?.every((car) => car.phase === 2), {
          intervals: [10],
        })
        .toBe(true);
      samples.push(await Promise.all(pages.map(read)));
      await info.attach("dual-return.png", {
        body: await pages[0].screenshot(),
        contentType: "image/png",
      });
      await expect
        .poll(async () => (await read(pages[0])).cars?.map((car) => [car.phase, car.lane]), {
          intervals: [20],
        })
        .toEqual([
          [0, 0],
          [0, 2],
        ]);
      // The leader overtakes at NOS in a separate lane, then merges while clear.
      await pages[leader].keyboard.down("ArrowUp");
      await expect
        .poll(
          async () => {
            const cars = (await read(pages[leader])).cars!;
            return cars[leader].progress - cars[follower].progress;
          },
          { intervals: [20] },
        )
        .toBeGreaterThan(160);
      await pages[leader].keyboard.up("ArrowUp");
      await pages[leader].keyboard.press(towardMiddle(leader));
      await expect
        .poll(async () => (await read(pages[leader])).cars?.[leader].lane, { intervals: [20] })
        .toBe(1);
      await pages[follower].keyboard.press(towardMiddle(follower));
      await expect
        .poll(async () => (await read(pages[follower])).cars?.[follower].lane, { intervals: [20] })
        .toBe(1);
      await pages[follower].keyboard.down("ArrowUp");
      await expect
        .poll(
          async () => {
            const cars = (await read(pages[follower])).cars!;
            return Math.abs(cars[leader].progress - cars[follower].progress - 80);
          },
          { intervals: [20] },
        )
        .toBeLessThan(1e-6);
      await expect(pages[follower].getByTestId("nos-status")).toHaveAttribute(
        "data-nos-state",
        "active",
      );
      samples.push(await Promise.all(pages.map(read)));
      await pages[follower].waitForTimeout(250);
      const locked = (await read(pages[follower])).cars!;
      expect(locked[leader].progress - locked[follower].progress).toBeCloseTo(80, 6);
      expect(locked.map((car) => car.hp)).toEqual([3, 3]);
      // Steering cancels NOS but cannot start a lane shift during the lock.
      await pages[follower].keyboard.press(outward(follower));
      await pages[follower].keyboard.up("ArrowUp");
      await pages[follower].waitForTimeout(100);
      expect((await read(pages[follower])).cars![follower].lane).toBe(1);
      await pages[follower].keyboard.down("ArrowUp");
      // The leader clears sideways, releasing requested NOS immediately.
      await pages[leader].keyboard.press(outward(leader));
      await expect
        .poll(
          async () => {
            const cars = (await read(pages[follower])).cars!;
            return cars[follower].progress - cars[leader].progress;
          },
          { intervals: [20] },
        )
        .toBeGreaterThan(40);
      samples.push(await Promise.all(pages.map(read)));
      await info.attach("overtake.png", {
        body: await pages[follower].screenshot(),
        contentType: "image/png",
      });
      for (const page of pages)
        await expect(page.getByRole("heading", { name: "Round Over" })).toBeVisible({
          timeout: 20000,
        });
      const outcomes = await Promise.all(
        pages.map((page) =>
          page
            .getByTestId("outcome-evidence")
            .textContent()
            .then((value) => JSON.parse(value!)),
        ),
      );
      expect(outcomes[0]).toMatchObject({ result: follower, reason: 0 });
      expect(outcomes[0].cars).toEqual(outcomes[1].cars);
      expect(outcomes[0].timeUs).toBe(outcomes[1].timeUs);
      const observations = await Promise.all(
        pages.map((page) =>
          page.evaluate(
            () => (window as unknown as { contactObservations: unknown[] }).contactObservations,
          ),
        ),
      );
      for (const page of pages) {
        const state = await read(page);
        expect(state.errors).toEqual([]);
        expect(state.verified).toBeGreaterThan(0);
      }
      await info.attach("contacts.json", {
        body: JSON.stringify({
          leader,
          samples,
          observations,
          outcomes,
          environments: await Promise.all(
            pages.map((page) =>
              page.evaluate(() => ({
                userAgent: navigator.userAgent,
                width: innerWidth,
                height: innerHeight,
              })),
            ),
          ),
        }),
        contentType: "application/json",
      });
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
