import fs from "node:fs";
import { test, expect } from "@playwright/test";

// A deliberately slow, validated test configuration widens the open-group
// interval for deterministic native-browser recovery. It is not a latency target.
for (const action of ["recover", "leave"])
  for (const recovering of [0, 1])
    test(`${action} respects a complete tick-boundary event group (seat ${recovering})`, async ({
      browser,
      baseURL,
    }, info) => {
      test.setTimeout(30000);
      const serverLog = process.env.DASHDEVIL_SERVER_LOG!;
      const offset = fs.statSync(serverLog).size;
      const contexts = await Promise.all(
        [0, 1].map(() => browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } })),
      );
      const pages = await Promise.all(contexts.map((context) => context.newPage()));
      const logRecords = () =>
        fs
          .readFileSync(serverLog, "utf8")
          .slice(offset)
          .split("\n")
          .flatMap((line) => {
            try {
              return [JSON.parse(line)];
            } catch {
              return [];
            }
          });
      const read = async (seat: number) =>
        JSON.parse((await pages[seat].getByTestId("room-evidence").textContent())!);
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
        const initial = await Promise.all([read(0), read(1)]);
        const room = initial[0].identity.roomId;
        for (const page of pages)
          await page.getByRole("button", { name: "Ready", exact: true }).click();
        await pages[0].getByRole("button", { name: "Start round" }).click();
        await expect
          .poll(
            () =>
              logRecords().some(
                (record) => record.msg === "race_group_pending" && record.room === room,
              ),
            { intervals: [5, 10], timeout: 10000 },
          )
          .toBe(true);
        if (action === "recover") {
          await pages[recovering].reload();
          await pages[recovering].getByRole("button", { name: /Drag Race/ }).click();
          await expect
            .poll(
              () =>
                logRecords().some(
                  (record) =>
                    record.msg === "baseline_waiting_group" &&
                    record.room === room &&
                    record.seat === recovering,
                ),
              { intervals: [5, 10], timeout: 2000 },
            )
            .toBe(true);
        } else {
          await pages[recovering].getByRole("button", { name: "Leave", exact: true }).click();
          await pages[recovering].getByRole("button", { name: "Confirm leave" }).click();
        }
        const remaining = action === "recover" ? [0, 1] : [1 - recovering];
        for (const seat of remaining)
          await expect(pages[seat].getByRole("heading", { name: "Round Over" })).toBeVisible({
            timeout: 5000,
          });
        const outcomes = await Promise.all(
          remaining.map((seat) =>
            pages[seat]
              .getByTestId("outcome-evidence")
              .textContent()
              .then((value) => JSON.parse(value!)),
          ),
        );
        for (const outcome of outcomes) {
          expect(outcome).toMatchObject({ result: 2, reason: 0, timeUs: 1000000 });
          expect(outcome.cars.map((car: { progress: number }) => car.progress)).toEqual([400, 400]);
          expect(outcome.cars).toEqual(outcomes[0].cars);
        }
        const final = await Promise.all(remaining.map(read));
        for (const state of final) expect(state.errors).toEqual([]);
        if (action === "recover") {
          expect(final[recovering].identity.pairGeneration).toBeGreaterThan(
            initial[recovering].identity.pairGeneration,
          );
          expect(final[recovering].identity.seatSession).toBe(
            initial[recovering].identity.seatSession,
          );
        }
        await info.attach("group-recovery.json", {
          body: JSON.stringify({
            action,
            recovering,
            initial,
            final,
            outcomes,
            server: logRecords(),
          }),
          contentType: "application/json",
        });
        await info.attach("group-result.png", {
          body: await pages[remaining[0]].screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    });
