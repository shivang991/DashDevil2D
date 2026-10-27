import { test, expect } from "@playwright/test";

// Cross-channel application delivery fixtures over real HTTPS/WebTransport.
// These are finality checks, not measurements of a network impairment profile.
for (const delayed of [0, 1])
  test(`outcome precedes old room state and a recovery baseline (seat ${delayed})`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(45000);
    const contexts = await Promise.all(
      [0, 1].map(() => browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } })),
    );
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    try {
      await pages[delayed].addInitScript(() => {
        const Native = WebSocket;
        const setter = Object.getOwnPropertyDescriptor(Native.prototype, "onmessage")!.set!;
        const waiting: (() => void)[] = [];
        window.addEventListener("releaseFinalityRoom", () => {
          for (const deliver of waiting.splice(0)) deliver();
        });
        window.WebSocket = class extends Native {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            Object.defineProperty(this, "onmessage", {
              set(handler: (event: MessageEvent) => void) {
                setter.call(this, (event: MessageEvent) => {
                  const bytes = new Uint8Array(event.data);
                  // Framed RoomState: length4,type1,Identity13,revision4,mode1,phase1.
                  if (
                    !sessionStorage.getItem("finalityReload") &&
                    bytes[4] === 5 &&
                    bytes[23] >= 2
                  ) {
                    document.documentElement.dataset.delayedRoomState = String(bytes[23]);
                    waiting.push(() => handler.call(this, event));
                  } else handler.call(this, event);
                });
              },
            });
          }
        };
      });
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
      await expect(pages[delayed].getByTestId("countdown")).toBeVisible();
      await expect(pages[1 - delayed].getByRole("heading", { name: "Round Over" })).toBeVisible({
        timeout: 15000,
      });
      await expect(pages[delayed].locator("html")).toHaveAttribute("data-delayed-room-state", "3");
      await expect(pages[delayed].getByRole("heading", { name: "Round Over" })).toBeVisible({
        timeout: 1000,
      });
      const outcomes = await Promise.all(
        pages.map((page) =>
          page
            .getByTestId("outcome-evidence")
            .textContent()
            .then((value) => JSON.parse(value!)),
        ),
      );
      expect(outcomes[0]).toMatchObject({ result: 2, reason: 0, timeUs: 5900000 });
      expect(outcomes[0].cars).toEqual(outcomes[1].cars);
      expect(outcomes[0].timeUs).toBe(outcomes[1].timeUs);
      await info.attach("outcome-before-room.png", {
        body: await pages[delayed].screenshot(),
        contentType: "image/png",
      });
      await pages[delayed].evaluate(() => window.dispatchEvent(new Event("releaseFinalityRoom")));
      await expect(pages[delayed].getByRole("button", { name: "Return to Lobby" })).toBeVisible();
      expect(
        JSON.parse((await pages[delayed].getByTestId("outcome-evidence").textContent())!),
      ).toEqual(outcomes[delayed]);
      // Reload the final room: let control deliver the self-contained outcome while
      // authority initialization is still incomplete, then finish the real transfer.
      await pages[delayed].addInitScript(() => {
        const Native = WebTransport;
        window.WebTransport = class extends Native {
          get incomingUnidirectionalStreams() {
            return super.incomingUnidirectionalStreams.pipeThrough(
              new TransformStream({
                transform(stream: ReadableStream<Uint8Array>, controller) {
                  controller.enqueue(
                    stream.pipeThrough(
                      new TransformStream({
                        async transform(bytes, output) {
                          await new Promise((resolve) => setTimeout(resolve, 700));
                          output.enqueue(bytes);
                        },
                      }),
                    ),
                  );
                },
              }),
            );
          }
        };
      });
      await pages[delayed].evaluate(() => sessionStorage.setItem("finalityReload", "1"));
      await pages[delayed].reload();
      await pages[delayed].getByRole("button", { name: /Drag Race/ }).click();
      await expect(pages[delayed].getByRole("heading", { name: "Round Over" })).toBeVisible({
        timeout: 1200,
      });
      const before = JSON.parse((await pages[delayed].getByTestId("room-evidence").textContent())!);
      expect(before.baselineBytes).toBe(0);
      await expect
        .poll(
          async () =>
            JSON.parse((await pages[delayed].getByTestId("room-evidence").textContent())!)
              .baselineBytes,
        )
        .toBeGreaterThan(0);
      const recovered = JSON.parse(
        (await pages[delayed].getByTestId("outcome-evidence").textContent())!,
      );
      expect(recovered.cars).toEqual(outcomes[delayed].cars);
      expect(recovered).toMatchObject({ result: 2, reason: 0, timeUs: 5900000 });
      const evidence = await Promise.all(
        pages.map((page) =>
          page
            .getByTestId("room-evidence")
            .textContent()
            .then((value) => JSON.parse(value!)),
        ),
      );
      for (const state of evidence) expect(state.errors).toEqual([]);
      const environments = await Promise.all(
        pages.map((page) =>
          page.evaluate(() => {
            const canvas = document.querySelector("canvas");
            return {
              userAgent: navigator.userAgent,
              viewport: { width: innerWidth, height: innerHeight },
              devicePixelRatio,
              canvas: canvas
                ? {
                    width: canvas.width,
                    height: canvas.height,
                    displayed: {
                      width: canvas.getBoundingClientRect().width,
                      height: canvas.getBoundingClientRect().height,
                    },
                  }
                : null,
            };
          }),
        ),
      );
      await info.attach("finality.json", {
        body: JSON.stringify({ delayed, outcomes, before, recovered, evidence, environments }),
        contentType: "application/json",
      });
      await info.attach("recovered-result.png", {
        body: await pages[delayed].screenshot(),
        contentType: "image/png",
      });
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
