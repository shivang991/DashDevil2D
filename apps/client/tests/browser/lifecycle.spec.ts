import { test, expect, type Page } from "@playwright/test";
const read = async (page: Page) =>
  JSON.parse((await page.getByTestId("room-evidence").textContent())!);

test("default course: native menu controls, recovered authority, shared results and fresh rematch on reused pairs", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(160000);
  const contexts = await Promise.all([
    browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } }),
    browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } }),
  ]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const records: unknown[] = [];
  const pageErrors: string[] = [];
  for (const page of pages) page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    // Retain a handle only to the native transport boundary, never a product setter.
    await pages[1].addInitScript(() => {
      const Native = window.WebTransport;
      let connections = 0;
      window.WebTransport = class extends Native {
        private replacement = ++connections > 1;
        get incomingUnidirectionalStreams() {
          if (!this.replacement) return super.incomingUnidirectionalStreams;
          return super.incomingUnidirectionalStreams.pipeThrough(
            new TransformStream({
              async transform(stream: ReadableStream<Uint8Array>, controller) {
                await new Promise((resolve) => setTimeout(resolve, 700));
                controller.enqueue(stream);
              },
            }),
          );
        }
        constructor(url: string | URL, options?: WebTransportOptions) {
          super(url, options);
          (window as unknown as { closeGameplay: () => void }).closeGameplay = () => this.close();
        }
      };
    });
    for (const page of pages) {
      await page.goto("/");
      await page.getByRole("button", { name: /Drag Race/ }).click();
    }
    await pages[0].getByRole("button", { name: "Create Room", exact: true }).click();
    await expect(pages[0].getByTestId("connection-state")).toHaveText("Connected");
    const code = await pages[0].getByTestId("room-code").innerText();
    await pages[1].getByRole("button", { name: "Join Room", exact: true }).click();
    await pages[1].getByLabel("Room code").fill(code);
    await pages[1].getByLabel("Room code").press("Enter");
    await expect(pages[1].getByTestId("connection-state")).toHaveText("Connected");
    const start = async () => {
      for (const page of pages)
        await page.getByRole("button", { name: "Ready", exact: true }).click();
      await expect(pages[0].getByRole("button", { name: "Start round" })).toBeEnabled();
      await pages[0].getByRole("button", { name: "Start round" }).click();
      for (const page of pages) {
        await expect(page.getByTestId("countdown")).toBeVisible();
        await page.keyboard.down("ArrowUp");
      }
      for (const page of pages)
        await expect(page.getByRole("img", { name: "Multiplayer race" })).toBeVisible();
      for (const page of pages) {
        await expect(page.getByTestId("nos-status")).toHaveText("NOS ready");
        await page.keyboard.up("ArrowUp");
      }
    };
    await start();
    const initial = await Promise.all(pages.map(read));
    records.push({ initial });
    expect(initial[0].context.gameplay.finishDistance).toBe(24000);
    const canvas = pages[0].getByRole("img", { name: "Multiplayer race" });
    await canvas.focus();
    await pages[0].keyboard.down("ArrowUp");
    await expect(pages[0].getByTestId("nos-status")).toHaveText("NOS active");
    await pages[0].keyboard.press("Escape");
    await expect(pages[0].getByRole("button", { name: "Resume", exact: true })).toBeFocused();
    await expect(pages[0].getByTestId("nos-status")).toHaveText("NOS ready");
    await pages[0].getByRole("button", { name: "Resume", exact: true }).press("Space");
    await expect(canvas).toBeFocused();
    await expect(pages[0].getByTestId("nos-status")).toHaveText("NOS ready");
    await pages[0].keyboard.up("ArrowUp");
    await pages[0].keyboard.down("ArrowUp");
    await expect(pages[0].getByTestId("nos-status")).toHaveText("NOS active");
    await pages[0].keyboard.up("ArrowUp");
    await pages[1].evaluate(() =>
      (window as unknown as { closeGameplay: () => void }).closeGameplay(),
    );
    await expect(pages[0].getByText("Opponent disconnected—round continues.")).toBeVisible();
    await expect(pages[1].getByTestId("connection-state")).toHaveText("Connected", {
      timeout: 10000,
    });
    const recovered = await read(pages[1]);
    records.push({ recovered });
    expect(recovered.identity.seatSession).toBe(initial[1].identity.seatSession);
    expect(recovered.identity.pairGeneration).toBeGreaterThan(initial[1].identity.pairGeneration);
    expect(recovered.cars[1].inputGeneration).toBeGreaterThan(initial[1].cars[1].inputGeneration);
    expect(recovered.timeUs).toBeGreaterThan(initial[1].timeUs);
    await expect(pages[1].getByTestId("nos-status")).toHaveText("NOS ready");
    await pages[0].getByRole("button", { name: "Leave", exact: true }).click();
    await expect(pages[0].getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await pages[0].keyboard.press("Escape");
    await expect(canvas).toBeFocused();
    await pages[0].getByRole("button", { name: "Leave", exact: true }).click();
    for (const page of pages)
      await expect(page.getByRole("heading", { name: "Round result" })).toBeVisible({
        timeout: 65000,
      });
    await expect(pages[0].getByRole("dialog")).toHaveCount(0);
    const outcomes = await Promise.all(
      pages.map(async (page) =>
        JSON.parse((await page.getByTestId("outcome-evidence").textContent())!),
      ),
    );
    expect(outcomes[0].cars).toEqual(outcomes[1].cars);
    expect(outcomes[0].timeUs).toBe(outcomes[1].timeUs);
    expect(outcomes[0].result).toBe(outcomes[1].result);
    const finished = await Promise.all(pages.map(read));
    records.push({ outcomes, finished });
    await info.attach("final-result.png", {
      body: await pages[0].screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await pages[1].getByRole("button", { name: "Return to Lobby", exact: true }).click();
    for (const page of pages) {
      await expect(page.getByRole("button", { name: "Ready", exact: true })).toBeVisible();
      await expect(page.getByTestId("room-code")).toHaveText(code);
      await expect(page.getByRole("heading", { name: "Round result" })).toBeVisible();
    }
    await expect(pages[0].getByLabel("Multiplayer mode")).toBeVisible();
    await expect(pages[0].getByRole("button", { name: "Start round" })).toHaveCount(0);
    await pages[1].getByRole("button", { name: "Dismiss result" }).click();
    await expect(pages[1].getByRole("heading", { name: "Round result" })).toHaveCount(0);
    // Mode capture changes in lobby, then restore Drag Race for another playable round.
    await pages[0].getByRole("button", { name: "Road Rage", exact: true }).click();
    await expect(pages[1].getByTestId("selected-mode")).toHaveText("Road Rage");
    await pages[0].getByRole("button", { name: "Drag Race", exact: true }).click();
    await expect(pages[1].getByTestId("selected-mode")).toHaveText("Drag Race");
    await start();
    const rematch = await Promise.all(pages.map(read));
    records.push({ rematch });
    for (let seat = 0; seat < 2; seat++) {
      expect(rematch[seat].roundId).toBeGreaterThan(initial[seat].roundId);
      expect(rematch[seat].identity).toEqual(finished[seat].identity);
      expect(rematch[seat].seed).not.toBe(initial[seat].seed);
      expect(
        rematch[seat].cars.map((car: { hp: number; heldMask: number; score: number }) => [
          car.hp,
          car.heldMask,
          car.score,
        ]),
      ).toEqual([
        [3, 0, 0],
        [3, 0, 0],
      ]);
      expect(rematch[seat].cars[seat].inputGeneration).toBeGreaterThan(
        finished[seat].cars[seat].inputGeneration,
      );
    }
    for (const page of pages)
      await expect(page.getByRole("heading", { name: "Round result" })).toBeVisible({
        timeout: 65000,
      });
    const again = await Promise.all(
      pages.map(async (page) =>
        JSON.parse((await page.getByTestId("outcome-evidence").textContent())!),
      ),
    );
    expect(again[0].roundId).toBe(rematch[0].roundId);
    expect(again[0].cars).toEqual(again[1].cars);
    expect(again[0].timeUs).toBe(again[1].timeUs);
    records.push({
      again,
      states: await Promise.all(pages.map(read)),
      environments: await Promise.all(
        pages.map((page) =>
          page.evaluate(() => ({
            userAgent: navigator.userAgent,
            viewport: [innerWidth, innerHeight],
            canvas: (() => {
              const canvas = document.querySelector("canvas");
              return canvas
                ? {
                    width: canvas.width,
                    height: canvas.height,
                    displayedWidth: canvas.clientWidth,
                    displayedHeight: canvas.clientHeight,
                  }
                : null;
            })(),
          })),
        ),
      ),
    });
    expect(pageErrors).toEqual([]);
  } finally {
    records.push({ pageErrors });
    await info.attach("lifecycle.json", {
      body: JSON.stringify(records),
      contentType: "application/json",
    });
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("suspension restores a fresh generation; forfeit survives reload and replacement guest sees a clean lobby", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(45000);
  const contexts = await Promise.all([
    browser.newContext({ baseURL }),
    browser.newContext({ baseURL }),
    browser.newContext({ baseURL }),
  ]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const records: unknown[] = [];
  const pageErrors: string[] = [];
  for (const page of pages) page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await pages[0].addInitScript(() => {
      const Native = window.WebTransport;
      const corrupted = new Set<number>();
      window.WebTransport = class extends Native {
        private verification?: WebTransportDatagramDuplexStream;
        get datagrams() {
          if (!this.verification) {
            const original = super.datagrams;
            const readable = original.readable.pipeThrough(
              new TransformStream({
                transform(bytes: Uint8Array, controller) {
                  const epoch = new DataView(
                    bytes.buffer,
                    bytes.byteOffset,
                    bytes.byteLength,
                  ).getUint16(0);
                  if (
                    corrupted.size < 2 &&
                    !corrupted.has(epoch) &&
                    Number(
                      document.querySelector('[data-testid="round-time"]')?.textContent ?? 0,
                    ) >= 400000
                  ) {
                    corrupted.add(epoch);
                    bytes = bytes.slice();
                    bytes[9] ^= 1;
                    document.documentElement.dataset.corruptedEpochs = String(corrupted.size);
                  }
                  controller.enqueue(bytes);
                },
              }),
            );
            this.verification = new Proxy(original, {
              get(target, name) {
                return name === "readable" ? readable : Reflect.get(target, name, target);
              },
            });
          }
          return this.verification;
        }
      };
    });
    for (const page of pages) {
      await page.goto("/");
      await page.getByRole("button", { name: /Drag Race/ }).click();
    }
    await pages[0].getByRole("button", { name: "Create Room", exact: true }).click();
    await expect(pages[0].getByTestId("connection-state")).toHaveText("Connected");
    const code = await pages[0].getByTestId("room-code").innerText();
    await pages[1].getByRole("button", { name: "Join Room", exact: true }).click();
    await pages[1].getByLabel("Room code").fill(code);
    await pages[1].getByLabel("Room code").press("Enter");
    await expect(pages[1].getByTestId("connection-state")).toHaveText("Connected");
    for (const page of pages.slice(0, 2))
      await page.getByRole("button", { name: "Ready", exact: true }).click();
    await expect(pages[0].getByRole("button", { name: "Start round" })).toBeEnabled();
    await pages[0].getByRole("button", { name: "Start round" }).click();
    const canvas = pages[1].getByRole("img", { name: "Multiplayer race" });
    await expect(canvas).toBeVisible();
    await canvas.focus();
    await pages[1].keyboard.down("ArrowUp");
    await expect(pages[1].getByTestId("nos-status")).toHaveText("NOS active");
    const before = await read(pages[1]);
    records.push({ before });
    // Explicit platform fixture, not physical tab-suspension or OS-focus evidence.
    await pages[1].evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(pages[1].getByTestId("nos-status")).toHaveText("NOS ready");
    await expect.poll(async () => (await read(pages[0])).timeUs).toBeGreaterThan(before.timeUs);
    await pages[1].evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect
      .poll(async () => (await read(pages[1])).identity.pairGeneration)
      .toBeGreaterThan(before.identity.pairGeneration);
    await expect(pages[1].getByTestId("connection-state")).toHaveText("Connected");
    await expect(canvas).toBeFocused();
    await expect(pages[1].getByTestId("nos-status")).toHaveText("NOS ready");
    await pages[1].keyboard.up("ArrowUp");
    await pages[1].keyboard.down("ArrowUp");
    await expect(pages[1].getByTestId("nos-status")).toHaveText("NOS active");
    await pages[1].keyboard.up("ArrowUp");
    const restored = await read(pages[1]);
    records.push({ restored });
    await expect(pages[0].locator("html")).toHaveAttribute("data-corrupted-epochs", "2");
    await expect
      .poll(async () => (await read(pages[0])).diagnostics.baselineEpochs.at(-1))
      .toBeGreaterThan(3);
    expect((await read(pages[0])).errors).toEqual([]);
    expect(restored.cars[1].inputGeneration).toBeGreaterThan(before.cars[1].inputGeneration);
    await pages[1].getByRole("button", { name: "Leave", exact: true }).click();
    await pages[1].getByRole("button", { name: "Confirm leave" }).click();
    await expect(pages[0].getByText("Forfeit", { exact: true })).toBeVisible();
    const outcome = JSON.parse((await pages[0].getByTestId("outcome-evidence").textContent())!);
    expect(outcome.result).toBe(0);
    expect(outcome.reason).toBe(3);
    await pages[0].reload();
    await pages[0].getByRole("button", { name: /Drag Race/ }).click();
    await expect(pages[0].getByText("Forfeit", { exact: true })).toBeVisible();
    const recoveredOutcome = JSON.parse(
      (await pages[0].getByTestId("outcome-evidence").textContent())!,
    );
    expect(recoveredOutcome.cars).toEqual(outcome.cars);
    expect(recoveredOutcome.timeUs).toBe(outcome.timeUs);
    await pages[2].getByRole("button", { name: "Join Room", exact: true }).click();
    await pages[2].getByLabel("Room code").fill(code);
    await pages[2].getByLabel("Room code").press("Enter");
    await expect(pages[2].getByTestId("connection-state")).toHaveText("Connected");
    for (const page of [pages[0], pages[2]])
      await expect(page.getByRole("button", { name: "Ready", exact: true })).toBeVisible();
    await expect(pages[0].getByRole("heading", { name: "Round result" })).toBeVisible();
    await expect(pages[2].getByRole("heading", { name: "Round result" })).toHaveCount(0);
    await expect(pages[0].getByRole("button", { name: "Start round" })).toHaveCount(0);
    records.push({
      outcome,
      recoveredOutcome,
      final: await Promise.all([pages[0], pages[2]].map(read)),
    });
    await info.attach("replacement-lobby.png", {
      body: await pages[2].screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    expect(pageErrors).toEqual([]);
  } finally {
    records.push({ pageErrors });
    await info.attach("suspension-forfeit.json", {
      body: JSON.stringify(records),
      contentType: "application/json",
    });
    await Promise.all(contexts.map((context) => context.close()));
  }
});
