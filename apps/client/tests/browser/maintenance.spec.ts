import { loginTestAccount } from "./account-helpers";
import { test, expect, type Page } from "@playwright/test";
const read = async (page: Page) =>
  JSON.parse((await page.getByTestId("room-evidence").textContent())!);
test("planned maintenance keeps active play and final results, then abandons unfinished rounds and closes rooms", async ({
  browser,
  baseURL,
  request,
}, info) => {
  test.setTimeout(90000);
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () =>
      browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } }),
    ),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const records: unknown[] = [];
  const operator = process.env.DASHDEVIL_ADMIN_URL!;
  const createRound = async (pair: Page[]) => {
    for (const page of pair) {
      await page.goto("/");
      await loginTestAccount(page);
      await page.getByRole("button", { name: /Drag Race/ }).click();
    }
    await pair[0].getByRole("button", { name: "Create Room", exact: true }).click();
    await expect(pair[0].getByTestId("connection-state")).toHaveText("Connected");
    await pair[1].getByRole("button", { name: "Join Room", exact: true }).click();
    await pair[1].getByLabel("Room code").fill(await pair[0].getByTestId("room-code").innerText());
    await pair[1].getByLabel("Room code").press("Enter");
    await expect(pair[1].getByTestId("connection-state")).toHaveText("Connected");
    for (const page of pair) await page.getByRole("button", { name: "Ready", exact: true }).click();
    await expect(pair[0].getByRole("button", { name: "Start round" })).toBeEnabled();
    await pair[0].getByRole("button", { name: "Start round" }).click();
    for (const page of pair)
      await expect(page.getByRole("img", { name: "Multiplayer race" })).toBeVisible();
  };
  try {
    await createRound(pages.slice(0, 2));
    for (const page of pages.slice(0, 2))
      await expect(page.getByRole("heading", { name: "Round Over" })).toBeVisible({
        timeout: 65000,
      });
    const finished = JSON.parse((await pages[0].getByTestId("outcome-evidence").textContent())!);
    await createRound(pages.slice(2));
    const before = await read(pages[2]);
    expect((await request.get(`${operator}/readyz`)).status()).toBe(200);
    expect((await request.post(`${operator}/drain`)).status()).toBe(202);
    expect((await request.get(`${operator}/readyz`)).status()).toBe(503);
    const maintenance = await (await request.get(`${operator}/drain`)).json();
    await expect
      .poll(async () => (await read(pages[2])).timeUs, { intervals: [50] })
      .toBeGreaterThan(before.timeUs);
    for (const page of pages.slice(2)) {
      await expect(page.getByText("Round Abandoned", { exact: true })).toBeVisible();
    }
    const abandoned = await Promise.all(
      pages
        .slice(2)
        .map(async (page) =>
          JSON.parse((await page.getByTestId("outcome-evidence").textContent())!),
        ),
    );
    expect(abandoned[0].result).toBe(3);
    expect(abandoned[0].reason).toBe(7);
    expect(abandoned[0].timeUs).toBe(maintenance.deadlineUs - before.startUs);
    expect(abandoned[0].tick).toBe(Math.ceil((abandoned[0].timeUs * 60) / 1e6));
    // Shipped defaults: separate outer lanes, 400 units/s, no steering/NOS.
    // Obstacles can remove HP but do not change this forward speed.
    const expectedProgress = (abandoned[0].timeUs / 1e6) * 400;
    for (const car of abandoned[0].cars)
      expect(Math.abs(car.progress - expectedProgress)).toBeLessThanOrEqual(
        1e-6 + 1e-12 * Math.abs(expectedProgress),
      );
    expect(abandoned[0].cars).toEqual(abandoned[1].cars);
    expect(abandoned[0].timeUs).toBe(abandoned[1].timeUs);
    expect(JSON.parse((await pages[0].getByTestId("outcome-evidence").textContent())!)).toEqual(
      finished,
    );
    await info.attach("maintenance-result.png", {
      body: await pages[2].screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await expect
      .poll(async () => (await (await request.get(`${operator}/drain`)).json()).complete)
      .toBe(true);
    records.push({
      before,
      maintenance,
      abandoned,
      finished,
      states: await Promise.all(pages.map(read)),
      environments: await Promise.all(
        pages.map((page) =>
          page.evaluate(() => ({
            userAgent: navigator.userAgent,
            viewport: [innerWidth, innerHeight],
          })),
        ),
      ),
    });
  } finally {
    await info.attach("maintenance.json", {
      body: JSON.stringify(records),
      contentType: "application/json",
    });
    await Promise.all(contexts.map((context) => context.close()));
  }
});
