import { test, expect, type Page } from "@playwright/test";
import fixtures from "../../../../packages/contracts/race/responsibility.json" with { type: "json" };
import type { Multiplayer } from "@dashdevil/simulation/multiplayer";
import type { PairedState } from "../../src/transport/PairedConnection";
const read = async (page: Page) =>
  JSON.parse((await page.getByTestId("room-evidence").textContent())!) as PairedState;
test("actual browser executes every shared responsibility timeline", async ({ page }, info) => {
  await page.goto("/tests/browser/responsibility.html");
  await expect(page.locator("#state")).toContainText("fresh steering");
  const observations = await page.evaluate(
    () =>
      (
        window as unknown as {
          responsibility: {
            name: string;
            steps: {
              state: ReturnType<Multiplayer["snapshot"]>;
              admitted: boolean[];
              contactTimes: number[];
              contactHex: string;
            }[];
          }[];
        }
      ).responsibility,
  );
  for (const [index, scenario] of fixtures.scenarios.entries())
    for (const [stepIndex, expected] of scenario.steps.entries()) {
      const actual = observations[index].steps[stepIndex];
      expect(observations[index].name).toBe(scenario.name);
      expect(actual.admitted.every(Boolean)).toBe(true);
      expect(
        actual.state.cars.map((car) => car.hp),
        scenario.name,
      ).toEqual(expected.hp);
      expect(actual.contactTimes, scenario.name).toEqual(expected.contactTimes);
      for (const field of ["progress", "lateral"] as const)
        if (field in expected) {
          const values = expected[field as keyof typeof expected] as number[];
          actual.state.cars.forEach((car, seat) =>
            expect(Math.abs(car[field] - values[seat]), scenario.name).toBeLessThanOrEqual(
              fixtures.precision.absolute + fixtures.precision.relative * Math.abs(values[seat]),
            ),
          );
        }
      if ("contact" in expected) {
        expect(actual.state.contact).toEqual(expected.contact);
        expect(actual.contactHex).toBe(expected.contactHex);
      }
      if ("latestSeat" in expected)
        expect(actual.state.latestPress?.seat).toBe(expected.latestSeat);
      if ("latestOrder" in expected)
        expect(actual.state.latestPress?.order).toBe(expected.latestOrder);
      if ("returnDeparture" in expected)
        expect(actual.state.cars[0].departure).toBe(expected.returnDeparture);
      for (const field of ["movementStartUs", "movementEndUs"] as const)
        if (field in expected)
          expect(actual.state.cars.map((car) => car[field])).toEqual(
            expected[field as keyof typeof expected],
          );
      if ("spent" in expected)
        expect(
          Object.fromEntries(
            actual.state.objects.filter((o) => o.flags & 28).map((o) => [o.id, o.flags]),
          ),
        ).toEqual(expected.spent);
      if ("finish" in expected) {
        expect(actual.state.finish).toEqual(expected.finish);
        expect(actual.state.reason).toBe(expected.reason);
      }
      if ("separated" in expected) {
        const [a, b] = actual.state.cars;
        expect(
          Math.abs(a.lateral - b.lateral) >= 50 - 1e-6 ||
            Math.abs(a.progress - b.progress) >= 80 - 1e-6,
        ).toBe(true);
      }
    }
  await info.attach("shared-browser-timelines.json", {
    body: JSON.stringify({
      fixtureVersion: fixtures.version,
      seeds: fixtures.scenarios.map((s) => ("seed" in s ? s.seed : 1)),
      observations,
      userAgent: await page.evaluate(() => navigator.userAgent),
    }),
    contentType: "application/json",
  });
});
for (const scenario of ["protected-victim-0", "protected-victim-1", "reversal"])
  test(`Road Rage responsibility: ${scenario}`, async ({ browser, baseURL }, info) => {
    test.setTimeout(45000);
    const reversal = scenario === "reversal",
      victim = scenario === "protected-victim-1" ? 1 : 0,
      shifter = 1 - victim;
    const contexts = await Promise.all(
      [0, 1].map(() => browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } })),
    );
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    const errors: string[] = [];
    try {
      if (reversal)
        await pages[shifter].addInitScript(() => {
          // Delay authority delivery by 250ms over actual WebTransport. This is an
          // application-delivery fixture, not evidence of an impaired network envelope.
          const Native = window.WebTransport;
          window.WebTransport = class extends Native {
            get incomingUnidirectionalStreams() {
              return super.incomingUnidirectionalStreams.pipeThrough(
                new TransformStream({
                  transform(stream: ReadableStream<Uint8Array>, controller) {
                    controller.enqueue(
                      stream.pipeThrough(
                        new TransformStream({
                          transform(bytes, output) {
                            setTimeout(() => {
                              try {
                                output.enqueue(bytes);
                              } catch {
                                /* stream closed during teardown */
                              }
                            }, 250);
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
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("/");
        await page.getByRole("button", { name: /Road Rage/ }).click();
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
      for (const page of pages)
        await page.evaluate(() => {
          const observations: unknown[] = [];
          Object.assign(window, { responsibilityObservations: observations });
          setInterval(() => {
            const text = document.querySelector('[data-testid="room-evidence"]')?.textContent;
            if (text && observations.length < 4000)
              observations.push({
                authority: JSON.parse(text),
                hp: [0, 1].map(
                  (seat) => document.querySelector(`[data-testid="hp-${seat}"]`)?.textContent,
                ),
              });
          }, 10);
        });
      const toward = (seat: number) => (seat === 0 ? "ArrowRight" : "ArrowLeft");
      for (const page of pages) await page.getByRole("img", { name: "Multiplayer race" }).focus();
      await pages[victim].keyboard.press(toward(victim));
      await expect.poll(async () => (await read(pages[shifter])).cars?.[victim].lane).toBe(1);
      const before = await Promise.all(pages.map(read));
      expect(before[0].cars?.map((car) => car.hp)).toEqual([6, 6]);
      await pages[shifter].keyboard.press(toward(shifter));
      if (reversal) {
        // Place NOS on a later 60Hz application tick, still before the 87.5ms impact.
        await pages[victim].waitForTimeout(35);
        await pages[victim].keyboard.down("ArrowUp");
      }
      const selected = reversal ? shifter : victim;
      for (const page of pages)
        await expect.poll(async () => (await read(page)).cars?.[selected].hp).toBe(5);
      if (reversal) {
        await pages[victim].keyboard.up("ArrowUp");
        const observations = await pages[shifter].evaluate(
          () =>
            (window as unknown as { responsibilityObservations: { hp: string[] }[] })
              .responsibilityObservations,
        );
        expect(
          observations.some(
            (observation) =>
              observation.hp[victim] === "HP 5" && observation.hp[shifter] === "HP 6",
          ),
        ).toBe(true);
        await expect(pages[shifter].getByTestId(`hp-${victim}`)).toHaveText("HP 6");
        await expect(pages[shifter].getByTestId(`hp-${shifter}`)).toHaveText("HP 5");
      } else {
        await expect.poll(async () => (await read(pages[0])).cars?.[shifter].phase).toBe(0);
        await pages[shifter].keyboard.press(toward(shifter));
        await expect.poll(async () => (await read(pages[0])).contact?.episode).toBe(2);
        for (const page of pages)
          expect((await read(page)).cars?.map((car) => car.hp)).toEqual(
            victim === 0 ? [5, 6] : [6, 5],
          );
        const protectedState = await read(pages[0]);
        await expect
          .poll(async () => (await read(pages[0])).timeUs)
          .toBeGreaterThan(protectedState.cars![victim].protectionUs);
        await pages[shifter].keyboard.press(toward(shifter));
        for (const page of pages)
          await expect.poll(async () => (await read(page)).cars?.[victim].hp).toBe(4);
      }
      for (const page of pages) {
        const state = await read(page);
        expect(state.errors).toEqual([]);
        expect(state.verified).toBeGreaterThan(0);
      }
      expect(errors).toEqual([]);
      await info.attach("responsibility.png", {
        body: await pages[shifter].screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      const observations = await Promise.all(
        pages.map((page) =>
          page.evaluate(
            () =>
              (window as unknown as { responsibilityObservations: unknown[] })
                .responsibilityObservations,
          ),
        ),
      );
      await info.attach("responsibility.json", {
        body: JSON.stringify({
          scenario,
          before,
          after: await Promise.all(pages.map(read)),
          observations,
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
      await info.attach("final-state.json", {
        body: JSON.stringify(
          await Promise.all(
            pages.map(async (page) => ({
              state: await read(page).catch(() => null),
              observations: await page
                .evaluate(
                  () =>
                    (window as unknown as { responsibilityObservations: unknown[] })
                      .responsibilityObservations,
                )
                .catch(() => null),
            })),
          ),
        ),
        contentType: "application/json",
      });
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
