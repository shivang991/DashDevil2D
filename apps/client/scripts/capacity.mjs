import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { build } from "vite";
import { chromium } from "@playwright/test";

// Explicit live endpoint required: this command creates rooms and gameplay load.
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
if (!args.origin || new URL(args.origin).protocol !== "https:")
  throw new Error(
    "Usage: node scripts/capacity.mjs --origin=https://HOST [--rooms=50] [--seconds=1800]",
  );
const origin = new URL(args.origin).origin;
const roomCount = Number(args.rooms ?? 50);
const seconds = Number(args.seconds ?? 1800);
if (
  !Number.isInteger(roomCount) ||
  roomCount < 2 ||
  roomCount > 50 ||
  !Number.isInteger(seconds) ||
  seconds < 10
)
  throw new Error("rooms must be 2..50; seconds must be an integer >=10");
const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(client, "../..");
const output = path.resolve(
  args.output ?? path.join(client, "test-results", `capacity-${Date.now()}`),
);
fs.mkdirSync(output, { recursive: true });
const log = (value) => {
  const line = JSON.stringify({ at: new Date().toISOString(), ...value });
  fs.appendFileSync(path.join(output, "events.jsonl"), line + "\n");
  console.log(line);
};
const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout.trim();
const bundle = await build({
  configFile: false,
  root: client,
  logLevel: "error",
  resolve: { alias: { "@": path.join(client, "src") } },
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(client, "src/transport/PairedConnection.ts"),
      name: "CapacityClient",
      formats: ["iife"],
    },
  },
});
const code = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(
  (entry) => entry.type === "chunk",
).code;
fs.writeFileSync(
  path.join(output, "manifest.json"),
  JSON.stringify(
    {
      revision: git("rev-parse", "HEAD"),
      dirty: git("status", "--porcelain"),
      origin,
      roomCount,
      seconds,
      node: process.version,
      cpu: os.cpus()[0].model,
      platform: process.platform,
      bundleSha256: createHash("sha256").update(code).digest("hex"),
      scope:
        "One product UI room and remaining real-browser PairedConnection rooms. Load pages exercise optional-storage failure fallback, native TLS/WebSocket/WebTransport, default server configuration. Protocol agents predict frames without drawing; no screen-response claim. Random server seeds retained per player. Not a complete normal-condition acceptance verdict.",
    },
    null,
    2,
  ),
);
const browsers = [];
const rooms = [];
const ui = [];
const readUI = async (page) => JSON.parse(await page.getByTestId("room-evidence").textContent());
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (predicate, description, timeout = 15000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await wait(100);
  }
  throw new Error(`Timeout: ${description}`);
};
let success = false;
try {
  for (let i = 0; i < 3; i++) {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    browsers.push(browser);
    log({ event: "browser", index: i, version: browser.version() });
  }
  for (let seat = 0; seat < 2; seat++) {
    const page = await browsers[seat].newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(10000);
    ui.push(page);
    page.on("pageerror", (error) => log({ event: "ui-error", seat, error: error.message }));
    await page.goto(origin);
    await page.getByRole("button", { name: /Drag Race/ }).click();
  }
  await ui[0].getByRole("button", { name: "Create Room", exact: true }).click();
  await until(
    async () => (await ui[0].getByTestId("connection-state").innerText()) === "Connected",
    "UI host connected",
  );
  const roomCode = await ui[0].getByTestId("room-code").innerText();
  await ui[1].getByLabel("Room code").fill(roomCode);
  await ui[1].getByLabel("Room code").press("Enter");
  await until(
    async () => (await ui[1].getByTestId("connection-state").innerText()) === "Connected",
    "UI guest connected",
  );
  await wait(700);
  log({ event: "room-connected", room: 0, mode: 1 });
  for (let index = 1; index < roomCount; index++) {
    const page = await browsers[2].newPage();
    rooms.push({ page, index, mode: index % 2 ? 2 : 1 });
    await page.route(`${origin}/__capacity_harness`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Capacity transport agent</title>",
      }),
    );
    await page.goto(`${origin}/__capacity_harness`);
    await page.addScriptTag({ content: code });
    await page.evaluate(
      async ({ origin, mode }) => {
        // Product already supports unavailable optional storage. Keep credentials
        // in each connection's own admission, without changing transport behavior.
        Object.defineProperty(window, "sessionStorage", {
          get() {
            throw new DOMException(
              "Capacity fixture: optional storage unavailable",
              "SecurityError",
            );
          },
        });
        const clients = [0, 1].map(
          () => new window.CapacityClient.PairedConnection({ server: origin }, () => {}),
        );
        window.capacity = {
          clients,
          frames: 0,
          maxLoopMs: 0,
          last: performance.now(),
          changes: [],
          errors: [],
        };
        const ready = async (client) => {
          const end = performance.now() + 15000;
          while (client.state.status !== "Connected") {
            if (performance.now() > end)
              throw new Error(
                JSON.stringify({ status: client.state.status, errors: client.state.errors }),
              );
            await new Promise((r) => setTimeout(r, 50));
          }
        };
        await clients[0].connect(0, "", mode);
        await ready(clients[0]);
        await clients[1].connect(1, clients[0].state.code, mode);
        await ready(clients[1]);
        window.capacity.timer = setInterval(() => {
          const now = performance.now();
          window.capacity.maxLoopMs = Math.max(
            window.capacity.maxLoopMs,
            now - window.capacity.last,
          );
          window.capacity.last = now;
          window.capacity.frames++;
          for (const client of clients) {
            try {
              client.frame();
            } catch (error) {
              window.capacity.errors.push(error.message);
            }
          }
        }, 1000 / 60);
      },
      { origin, mode: index % 2 ? 2 : 1 },
    );
    log({ event: "room-connected", room: index, mode: index % 2 ? 2 : 1 });
    if (index % 5 === 0) log({ event: "ramp", rooms: index + 1, localFreeBytes: os.freemem() });
  }
  const snapshot = async (label) => {
    const records = [];
    for (let seat = 0; seat < ui.length; seat++)
      records.push({ room: 0, seat, kind: "product-ui", state: await readUI(ui[seat]) });
    for (const { page, index } of rooms) {
      const result = await page.evaluate(() => ({
        states: window.capacity.clients.map((c) => c.state),
        loop: { frames: window.capacity.frames, maxLoopMs: window.capacity.maxLoopMs },
        errors: window.capacity.errors,
      }));
      for (let seat = 0; seat < 2; seat++)
        records.push({
          room: index,
          seat,
          kind: "transport-agent",
          ...result.loop,
          harnessErrors: result.errors,
          state: result.states[seat],
        });
    }
    fs.appendFileSync(
      path.join(output, "players.jsonl"),
      JSON.stringify({ at: new Date().toISOString(), label, records }) + "\n",
    );
    log({
      event: "sample",
      label,
      connected: records.filter((r) => r.state.status === "Connected").length,
      players: records.length,
      phases: records.reduce((counts, r) => {
        const phase = r.state.room?.phase ?? "missing";
        counts[phase] = (counts[phase] ?? 0) + 1;
        return counts;
      }, {}),
      errors: records.flatMap((r) =>
        r.state.errors.map((error) => ({ room: r.room, seat: r.seat, error })),
      ),
    });
    return records;
  };
  const startUI = async () => {
    const state = await readUI(ui[0]);
    if (state.room.phase === 3) {
      await ui[0].getByRole("button", { name: "Return to Lobby", exact: true }).click();
      await wait(500);
    }
    if ((await readUI(ui[0])).room.phase !== 0) return;
    for (const page of ui) {
      if (await page.getByRole("button", { name: "Ready", exact: true }).count()) {
        await page.getByRole("button", { name: "Ready", exact: true }).click();
        await page.getByRole("button", { name: "Cancel ready", exact: true }).waitFor();
        await wait(350);
      }
    }
    await ui[0].getByRole("button", { name: "Start round", exact: true }).click();
  };
  const advanceAgent = async ({ page }) =>
    page.evaluate(async () => {
      const [host, guest] = window.capacity.clients;
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      const deadline = performance.now() + 8000;
      const until = async (fn) => {
        while (!fn()) {
          if (performance.now() > deadline) throw new Error("room command acknowledgement timeout");
          await delay(30);
        }
      };
      if (host.state.room.phase === 3) {
        host.command(5);
        await until(
          () => host.state.room.phase === 0 && guest.state.room.phase === 0 && !host.state.pending,
        );
      }
      if (host.state.room.phase !== 0) return;
      await delay(400);
      for (const c of [host, guest]) {
        c.command(1, host.state.room.mode, 1);
        await until(() => !c.state.pending && c.state.room.seats[c.state.identity.seat].flags & 2);
        await delay(350);
      }
      host.command(2);
      await until(() => host.state.room.phase === 1 || host.state.room.phase === 2);
    });
  await snapshot("full-capacity-before-start");
  const began = Date.now();
  let cycle = 0;
  while (Date.now() - began < seconds * 1000) {
    // All rooms receive the same cycle trigger; natural finishes remain authoritative.
    const results = await Promise.allSettled([startUI(), ...rooms.map(advanceAgent)]);
    const failures = results.flatMap((r, index) =>
      r.status === "rejected" ? [{ room: index, error: r.reason.message }] : [],
    );
    if (failures.length) {
      log({ event: "cycle-failed", cycle, failures });
      throw new Error("Coordinated room lifecycle failed");
    }
    await wait(4000);
    if (cycle % 4 === 1) {
      const chosen = rooms[cycle % rooms.length];
      await chosen.page.evaluate(() => window.capacity.clients[1].drop("gameplay"));
      log({ event: "reconnect-trigger", room: chosen.index });
    }
    const records = await snapshot(`cycle-${cycle}`);
    for (let seat = 0; seat < 2; seat++)
      await ui[seat].screenshot({
        path: path.join(output, `ui-${cycle}-${seat}.png`),
        fullPage: true,
      });
    if (records.some((r) => r.state.errors.some((e) => /mismatch|expired|abandon/i.test(e))))
      throw new Error("Client correctness/lifecycle error; retained full sample");
    await wait(6000);
    cycle++;
  }
  success = true;
  log({
    event: "duration-complete",
    elapsedMs: Date.now() - began,
    scope:
      "Load duration completed; metric/visual acceptance still requires independent assessment",
  });
} catch (error) {
  log({ event: "failure", error: error.stack });
  process.exitCode = 1;
} finally {
  for (const { page } of rooms) {
    try {
      await page.evaluate(() => {
        clearInterval(window.capacity?.timer);
        for (const c of window.capacity?.clients ?? []) c.leave();
      });
    } catch {}
  }
  for (let seat = 0; seat < ui.length; seat++) {
    try {
      fs.writeFileSync(
        path.join(output, `ui-final-${seat}.json`),
        JSON.stringify(await readUI(ui[seat]), null, 2),
      );
      await ui[seat].screenshot({
        path: path.join(output, `ui-final-${seat}.png`),
        fullPage: true,
      });
      await ui[seat].getByRole("button", { name: "Leave", exact: true }).click({ timeout: 1000 });
    } catch {}
  }
  await Promise.all(browsers.map((b) => b.close()));
  log({ event: "closed", success, output });
}
