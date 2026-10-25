import { test, expect } from "@playwright/test";

test("two admitted browser seats verify real streams/datagrams and recover either lost channel", async ({
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(45000);
  const contexts = await Promise.all([
    browser.newContext({ baseURL }),
    browser.newContext({ baseURL }),
  ]);
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  try {
    await Promise.all(pages.map((p) => p.goto("/transport.html")));
    await pages[0].getByRole("button", { name: "Create diagnostic room", exact: true }).click();
    await expect(pages[0].getByTestId("status")).toHaveText("Connected");
    const code = await pages[0].getByTestId("room-code").innerText();
    expect(code).toMatch(/^\d{4}$/);
    await pages[1].getByLabel("Room code").fill(code);
    await pages[1].getByRole("button", { name: "Join diagnostic room", exact: true }).click();
    for (const page of pages) {
      await expect(page.getByTestId("status")).toHaveText("Connected");
      await expect
        .poll(async () => Number(await page.getByTestId("verified").innerText()))
        .toBeGreaterThan(3);
      await expect(page.getByTestId("positions")).toHaveText("100.125, 20000.5");
      await expect
        .poll(async () => Number(await page.getByTestId("clock-samples").innerText()))
        .toBeGreaterThan(0);
    }
    await pages[0].getByRole("button", { name: "Request fresh baseline", exact: true }).click();
    await expect
      .poll(async () => JSON.parse(await pages[0].locator("#evidence").innerText()).baselineBytes)
      .toBe(2114);
    await expect(pages[0].getByTestId("status")).toHaveText("Connected");
    const sessions = await Promise.all(pages.map((p) => p.getByTestId("seat-session").innerText()));
    for (const channel of ["room", "gameplay"]) {
      await pages[0].getByRole("button", { name: `Drop ${channel} channel`, exact: true }).click();
      await expect(pages[1].getByTestId("connected-seats")).toHaveText("1");
      await pages[0].getByRole("button", { name: "Recover pair", exact: true }).click();
      await expect(pages[0].getByTestId("status")).toHaveText("Connected");
      await expect(pages[0].getByTestId("seat-session")).toHaveText(sessions[0]);
      await expect(pages[1].getByTestId("connected-seats")).toHaveText("2");
      await expect
        .poll(async () => Number(await pages[0].getByTestId("verified").innerText()))
        .toBeGreaterThan(2);
    }
    // Reload uses the same tab credential, replaces the pair and restores the fixture.
    await pages[0].reload();
    await pages[0].getByRole("button", { name: "Recover pair", exact: true }).click();
    await expect(pages[0].getByTestId("status")).toHaveText("Connected");
    await expect(pages[0].getByTestId("seat-session")).toHaveText(sessions[0]);
    await expect(pages[0].getByTestId("positions")).toHaveText("100.125, 20000.5");
    await expect(pages[1].getByTestId("seat-session")).toHaveText(sessions[1]);
    await pages[0].getByRole("button", { name: "Replace connected pair", exact: true }).click();
    await expect(pages[0].getByTestId("status")).toHaveText("Connected");
    await expect(pages[0].getByTestId("seat-session")).toHaveText(sessions[0]);
    await expect
      .poll(async () => Number(await pages[0].getByTestId("verified").innerText()))
      .toBeGreaterThan(3);
    for (let i = 0; i < pages.length; i++) {
      await testInfo.attach(`seat-${i + 1}-evidence.json`, {
        body: await pages[i].locator("#evidence").innerText(),
        contentType: "application/json",
      });
      await testInfo.attach(`seat-${i + 1}-connected.png`, {
        body: await pages[i].screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    }
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test("missing WebTransport features produce Browser unsupported", async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "WebTransport", { value: undefined, configurable: true });
  });
  await page.goto(`${baseURL}/transport.html`);
  await page.getByRole("button", { name: "Create diagnostic room", exact: true }).click();
  await expect(page.getByTestId("status")).toHaveText("Browser unsupported");
});

test("an admission/network failure is Unable to connect on a supported browser", async ({
  page,
  baseURL,
}) => {
  await page.route("**/admission", (route) => route.abort());
  await page.goto(`${baseURL}/transport.html`);
  await page.getByRole("button", { name: "Create diagnostic room", exact: true }).click();
  await expect(page.getByTestId("status")).toContainText("Unable to connect");
});
