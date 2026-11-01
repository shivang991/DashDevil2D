import { loginTestAccount } from "./account-helpers";
import { test, expect, type Page } from "@playwright/test";
const read = async (page: Page) =>
  JSON.parse((await page.getByTestId("room-evidence").textContent())!);
for (const mode of ["Drag Race", "Road Rage"])
  test(`${mode}: dense separated native baseline drain and stalled authority reader recovery`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(45000);
    const contexts = await Promise.all(
      [0, 1].map(() => browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } })),
    );
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    const errors: string[] = [];
    for (const page of pages) page.on("pageerror", (error) => errors.push(error.message));
    try {
      await pages[1].addInitScript(() => {
        const Native = window.WebTransport;
        let corrupt = false,
          stallUntil = 0;
        const fixture = window as unknown as {
          corruptVerification: () => void;
          stallAuthority: () => void;
        };
        fixture.corruptVerification = () => {
          corrupt = true;
        };
        fixture.stallAuthority = () => {
          stallUntil = performance.now() + 1800;
        };
        window.WebTransport = class extends Native {
          private transformedDatagrams?: WebTransportDatagramDuplexStream;
          get datagrams() {
            const native = super.datagrams;
            return (this.transformedDatagrams ??= {
              ...native,
              maxDatagramSize: native.maxDatagramSize,
              readable: native.readable.pipeThrough(
                new TransformStream<Uint8Array, Uint8Array>({
                  transform(value, controller) {
                    if (corrupt && value.length === 10) {
                      corrupt = false;
                      value = value.slice();
                      value[9] ^= 1;
                    }
                    controller.enqueue(value);
                  },
                }),
              ),
            });
          }
          get incomingUnidirectionalStreams() {
            return super.incomingUnidirectionalStreams.pipeThrough(
              new TransformStream<ReadableStream<Uint8Array>, ReadableStream<Uint8Array>>({
                transform(stream, controller) {
                  controller.enqueue(
                    stream.pipeThrough(
                      new TransformStream<Uint8Array, Uint8Array>({
                        async transform(bytes, output) {
                          const wait = stallUntil - performance.now();
                          if (wait > 0) {
                            stallUntil = 0;
                            await new Promise((resolve) => setTimeout(resolve, wait));
                          }
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
      for (const page of pages) {
        await page.goto("/");
        await loginTestAccount(page);
        await page.getByRole("button", { name: new RegExp(mode) }).click();
      }
      await pages[0].getByRole("button", { name: "Create Room", exact: true }).click();
      await expect(pages[0].getByTestId("connection-state")).toHaveText("Connected");
      const code = await pages[0].getByTestId("room-code").innerText();
      await pages[1].getByRole("button", { name: "Join Room", exact: true }).click();
      await pages[1].getByLabel("Room code").fill(code);
      await pages[1].getByLabel("Room code").press("Enter");
      await expect(pages[1].getByTestId("connection-state")).toHaveText("Connected");
      for (const page of pages)
        await page.getByRole("button", { name: "Ready", exact: true }).click();
      await expect(pages[0].getByRole("button", { name: "Start round" })).toBeEnabled();
      await pages[0].getByRole("button", { name: "Start round" }).click();
      for (const page of pages)
        await expect(page.getByRole("img", { name: "Multiplayer race" })).toBeVisible({
          timeout: 10000,
        });
      await pages[0].getByRole("img", { name: "Multiplayer race" }).focus();
      await pages[0].keyboard.down("ArrowUp");
      await expect(pages[0].getByTestId("nos-status")).toHaveAttribute("data-nos-state", "active");
      await expect
        .poll(
          async () => {
            const state = await read(pages[1]);
            return Math.abs(state.cars[0].progress - state.cars[1].progress);
          },
          { timeout: 10000 },
        )
        .toBeGreaterThan(2200);
      await pages[0].keyboard.up("ArrowUp");
      const before = await read(pages[1]);
      expect(before.objects.length).toBeGreaterThanOrEqual(350);
      expect(before.context.connection.reliableFrameBytes).toBe(7168);
      expect(before.context.connection.queueBytes).toBe(7168);
      await pages[1].evaluate(() =>
        (window as unknown as { corruptVerification: () => void }).corruptVerification(),
      );
      await expect
        .poll(async () => (await read(pages[1])).diagnostics.baselineEpochs.length)
        .toBeGreaterThan(before.diagnostics.baselineEpochs.length);
      const drained = await read(pages[1]);
      expect(drained.identity).toEqual(before.identity);
      expect(drained.baselineBytes - before.baselineBytes).toBeGreaterThan(7168);
      expect(drained.errors).toEqual([]);
      await expect
        .poll(async () => (await read(pages[1])).verified)
        .toBeGreaterThan(drained.verified);
      await pages[1].evaluate(() =>
        (window as unknown as { stallAuthority: () => void }).stallAuthority(),
      );
      await expect
        .poll(async () => (await read(pages[1])).identity.pairGeneration, { timeout: 12000 })
        .toBeGreaterThan(before.identity.pairGeneration);
      await expect(pages[1].getByTestId("connection-state")).toHaveText("Connected", {
        timeout: 10000,
      });
      const recovered = await read(pages[1]);
      expect(recovered.identity.seatSession).toBe(before.identity.seatSession);
      expect(recovered.cars[1].heldMask).toBe(0);
      expect(errors).toEqual([]);
      await info.attach("dense-drain.json", {
        body: JSON.stringify(
          {
            mode,
            before,
            drained,
            recovered,
            scope:
              "Real WebTransport bounded dense baseline installation; application authority reader delayed 1800ms. No packet-level bandwidth claim.",
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
      await info.attach("dense-recovery.png", {
        body: await pages[1].screenshot(),
        contentType: "image/png",
      });
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
