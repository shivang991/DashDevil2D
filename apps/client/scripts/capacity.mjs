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
if (fs.existsSync(output))
  throw new Error("Evidence directory already exists; use a fresh --output");
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
fs.writeFileSync(path.join(output, "client-bundle.js"), code);
fs.copyFileSync(fileURLToPath(import.meta.url), path.join(output, "harness-source.mjs"));
fs.writeFileSync(
  path.join(output, "manifest.json"),
  JSON.stringify(
    {
      revision: git("rev-parse", "HEAD"),
      dirty: git("status", "--porcelain"),
      diffSha256: createHash("sha256")
        .update(git("diff", "HEAD", "--binary"))
        .digest("hex"),
      sourceHashes: Object.fromEntries(
        [
          "apps/client/scripts/capacity.mjs",
          "apps/client/src/transport/PairedConnection.ts",
          "packages/contracts/configuration/defaults.json",
          "packages/contracts/protocol/schema.json",
          "packages/contracts/protocol/fixtures.json",
          "pnpm-lock.yaml",
        ].map((file) => [
          file,
          createHash("sha256")
            .update(fs.readFileSync(path.join(root, file)))
            .digest("hex"),
        ]),
      ),
      origin,
      roomCount,
      seconds,
      node: process.version,
      cpu: os.cpus()[0].model,
      platform: process.platform,
      bundleSha256: createHash("sha256").update(code).digest("hex"),
      scope:
        "One product UI room and remaining real-browser PairedConnection rooms in browser worker threads. Load pages exercise optional-storage failure fallback, native TLS/WebSocket/WebTransport, default server configuration. Protocol agents predict frames without drawing; no screen-response claim. Random server seeds retained per player. Not a complete normal-condition acceptance verdict.",
    },
    null,
    2,
  ),
);
const browsers = [];
const rooms = [];
const ui = [];
const readUI = async (page) => {
  const state = JSON.parse(await page.getByTestId("room-evidence").textContent());
  const status = await page.getByTestId("connection-state").innerText();
  const result = page.getByTestId("outcome-evidence");
  const outcome = (await result.count()) ? JSON.parse(await result.textContent()) : undefined;
  const phase = (await page.getByRole("button", { name: "Return to Lobby", exact: true }).count())
    ? 3
    : (await page.getByTestId("countdown").count())
      ? 1
      : (await page.getByRole("img", { name: "Multiplayer race" }).count())
        ? 2
        : 0;
  return {
    ...state,
    status,
    outcome,
    room: { phase, mode: 1 },
    roomPhaseSource: "observed product DOM",
  };
};
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
let captureFailure;
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
  const agentHost = await browsers[2].newPage();
  await agentHost.route(`${origin}/__capacity_harness`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Capacity transport agent</title>",
    }),
  );
  await agentHost.goto(`${origin}/__capacity_harness`);
  await agentHost.evaluate((code) => {
    const source =
      code +
      `\nself.window=self;self.onmessage=async({data})=>{try {const fn=(0,eval)("("+data.fn+")");self.postMessage({id:data.id,result:await fn(data.arg)});}catch(error){self.postMessage({id:data.id,error:error.stack??error.message});}};`;
    window.capacityWorkerURL = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    window.capacityWorkers = new Map();
    window.capacityCall = (index, fn, arg) =>
      new Promise((resolve, reject) => {
        const entry = window.capacityWorkers.get(index);
        if (entry.failed) {
          reject(new Error(entry.failed));
          return;
        }
        const id = ++entry.next;
        const timeout = setTimeout(() => {
          entry.pending.delete(id);
          reject(new Error(`Worker ${index} RPC timeout`));
        }, 30000);
        entry.pending.set(id, { resolve, reject, timeout });
        entry.worker.postMessage({ id, fn, arg });
      });
  }, code);
  for (let index = 1; index < roomCount; index++) {
    // Native browser workers isolate baseline validation without allocating a
    // renderer process per room. Retain each worker's scheduling measurements.
    await agentHost.evaluate((index) => {
      const entry = { worker: new Worker(window.capacityWorkerURL), next: 0, pending: new Map() };
      entry.worker.onmessage = ({ data }) => {
        const pending = entry.pending.get(data.id);
        if (!pending) return;
        entry.pending.delete(data.id);
        clearTimeout(pending.timeout);
        if (data.error) pending.reject(new Error(data.error));
        else pending.resolve(data.result);
      };
      entry.worker.onerror = (event) => {
        entry.failed = event.message;
        for (const pending of entry.pending.values()) {
          clearTimeout(pending.timeout);
          pending.reject(new Error(event.message));
        }
        entry.pending.clear();
      };
      window.capacityWorkers.set(index, entry);
    }, index);
    const page = {
      evaluate: (fn, arg) =>
        agentHost.evaluate(({ index, fn, arg }) => window.capacityCall(index, fn, arg), {
          index,
          fn: fn.toString(),
          arg,
        }),
    };
    rooms.push({ page, index, mode: index % 2 ? 2 : 1 });
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
        // Connection setup precedes loop scheduling; exclude it from loop delay.
        window.capacity.last = performance.now();
        window.capacity.timer = setInterval(() => {
          const now = performance.now();
          window.capacity.maxLoopMs = Math.max(
            window.capacity.maxLoopMs,
            now - window.capacity.last,
          );
          window.capacity.last = now;
          window.capacity.frames++;
          if (!window.capacity.pauseInputs && window.capacity.frames % 30 === 0) {
            for (const c of clients) {
              c.releaseControls();
              c.input(0, window.capacity.frames % 120 < 60 ? 1 : 3);
            }
          }
          for (const client of clients) {
            try {
              // Match RaceView's lifecycle: lobby baselines have no active
              // race clock and must not run gameplay prediction.
              if (client.state.room?.phase === 2 || client.state.room?.phase === 3) client.frame();
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
        changes: window.capacity.changes,
      }));
      for (let seat = 0; seat < 2; seat++)
        records.push({
          room: index,
          seat,
          kind: "transport-agent",
          ...result.loop,
          harnessErrors: result.errors,
          changes: result.changes,
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
  captureFailure = snapshot;
  const startUI = async () => {
    for (const page of ui) await page.keyboard.up("ArrowUp");
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
    for (const page of ui) {
      const canvas = page.getByRole("img", { name: "Multiplayer race" });
      await canvas.waitFor({ timeout: 10000 });
      await canvas.focus();
      await page.keyboard.down("ArrowUp");
    }
  };
  const advanceAgent = async ({ page }) =>
    page.evaluate(async () => {
      const [host, guest] = window.capacity.clients;
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      const deadline = performance.now() + 8000;
      const until = async (fn) => {
        while (!fn()) {
          if (performance.now() > deadline)
            throw new Error(
              "room command acknowledgement timeout: " +
                JSON.stringify(
                  [host, guest].map((c) => ({
                    status: c.state.status,
                    pending: c.state.pending,
                    notice: c.state.notice,
                    room: c.state.room,
                    errors: c.state.errors,
                  })),
                ),
            );
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
      const synchronized = () =>
        host.state.room.revision === guest.state.room.revision &&
        [host, guest].every((c) => c.state.status === "Connected" && !c.state.pending);
      const command = async (client, kind, mode, ready, accepted) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          await until(synchronized);
          const revision = client.state.room.revision;
          client.command(kind, mode, ready);
          await until(
            () =>
              synchronized() && (accepted() || client.state.notice === "Room changed; try again"),
          );
          if (accepted()) return;
          window.capacity.changes.push({
            event: "stale-room-command",
            command: kind,
            revision,
            nextRevision: client.state.room.revision,
          });
          await delay(100);
        }
        throw new Error("Room command repeatedly rejected as stale");
      };
      for (const c of [host, guest]) {
        await command(c, 1, host.state.room.mode, 1, () =>
          [host, guest].every((view) => view.state.room.seats[c.state.identity.seat].flags & 2),
        );
      }
      await command(host, 2, host.state.room.mode, 0, () =>
        [host, guest].every((c) => c.state.room.phase === 1 || c.state.room.phase === 2),
      );
    });
  const initial = await snapshot("full-capacity-before-start");
  if (initial.length !== roomCount * 2 || initial.some((r) => r.state.status !== "Connected"))
    throw new Error("Full player count not connected");
  const completions = new Map();
  let recoveries = 0;
  const recoveryModes = new Set();
  const previous = new Map();
  const roundStarts = new Map();
  const began = Date.now();
  const observeOutcomes = (records) => {
    for (const record of records) {
      const key = `${record.room}:${record.seat}`,
        state = record.state,
        before = previous.get(key);
      if (state.status !== "Connected") throw new Error(`Player disconnected ${key}`);
      if (
        before &&
        before.roundId === state.roundId &&
        before.room.phase === 2 &&
        state.room.phase === 2 &&
        state.timeUs <= before.timeUs
      )
        throw new Error(`Authority stalled ${key}`);
      const roundKey = `${record.room}:${state.roundId}`;
      if (state.room.phase === 1 || state.room.phase === 2) {
        if (!roundStarts.has(roundKey)) roundStarts.set(roundKey, Date.now());
        const gameplay = state.context?.gameplay;
        const expectedSeconds =
          gameplay?.timeLimit > 0
            ? gameplay.timeLimit
            : gameplay?.finishDistance / gameplay?.startingRoadSpeed;
        if (!Number.isFinite(expectedSeconds) || expectedSeconds <= 0)
          throw new Error(`Missing round deadline configuration ${roundKey}`);
        const maxMs = (expectedSeconds + 15) * 1000;
        if (Date.now() - roundStarts.get(roundKey) > maxMs)
          throw new Error(`Round exceeded finish deadline ${roundKey}`);
      }
      previous.set(key, state);
    }
    for (let room = 0; room < roomCount; room++) {
      const [a, b] = records.filter((r) => r.room === room).map((r) => r.state);
      if (
        a.outcome &&
        b.outcome &&
        a.outcome.roundId === a.roundId &&
        b.outcome.roundId === b.roundId
      ) {
        const canonical = ({ identity, ...result }) => result;
        for (const state of [a, b]) {
          const expected = state.identity,
            actual = state.outcome.identity;
          if (
            actual.roomId !== expected.roomId ||
            actual.seatSession !== expected.seatSession ||
            actual.seat !== expected.seat
          )
            throw new Error(`Outcome identity mismatch room ${room}`);
        }
        if (JSON.stringify(canonical(a.outcome)) !== JSON.stringify(canonical(b.outcome)))
          throw new Error(`Outcome mismatch room ${room}`);
        if (a.outcome.result === 3) throw new Error(`Abandoned round room ${room}`);
        completions.set(room, (completions.get(room) ?? new Set()).add(a.outcome.roundId));
      }
    }
  };
  let cycle = 0;
  while (Date.now() - began < seconds * 1000) {
    observeOutcomes(await snapshot(`cycle-${cycle}-before`));
    // All rooms receive the same cycle trigger; natural finishes remain authoritative.
    const results = await Promise.allSettled([startUI(), ...rooms.map(advanceAgent)]);
    const failures = results.flatMap((r, index) =>
      r.status === "rejected" ? [{ room: index, error: r.reason.message }] : [],
    );
    if (failures.length) {
      log({ event: "cycle-failed", cycle, failures });
      throw new Error("Coordinated room lifecycle failed");
    }
    if (cycle % 4 === 1) {
      const targetMode = Math.floor(cycle / 4) % 2 ? 2 : 1;
      const selected = [];
      for (const room of rooms.filter((room) => room.mode === targetMode)) {
        if (await room.page.evaluate(() => window.capacity.clients[1].state.room.phase === 2)) {
          selected.push(room);
        }
      }
      if (!selected.length && roomCount === 2) selected.push(rooms[0]);
      await Promise.all(
        selected.map(async (chosen) => {
          const before = await chosen.page.evaluate(() => {
            const s = window.capacity.clients[1].state;
            return { ...s.identity, phase: s.room.phase, roundId: s.roundId };
          });
          await chosen.page.evaluate(() => {
            window.capacity.pauseInputs = true;
            for (const c of window.capacity.clients) c.releaseControls();
            window.capacity.clients[1].drop("gameplay");
          });
          await until(
            async () =>
              chosen.page.evaluate((before) => {
                const c = window.capacity.clients[1];
                return (
                  c.state.status === "Connected" &&
                  c.state.identity.seatSession === before.seatSession &&
                  c.state.identity.pairGeneration > before.pairGeneration &&
                  c.state.roundId === before.roundId &&
                  (c.state.room?.phase === 2 || c.state.room?.phase === 3) &&
                  c.state.outcome?.result !== 3 &&
                  ((c.state.room?.phase === 2 && c.state.cars?.[1].heldMask === 0) ||
                    (c.state.room?.phase === 3 && c.state.outcome?.roundId === c.state.roundId))
                );
              }, before),
            "reconnect same seat with fresh controls",
            12000,
          );
          recoveries++;
          recoveryModes.add(chosen.mode);
          await chosen.page.evaluate(() => {
            window.capacity.pauseInputs = false;
          });
          log({ event: "reconnect-trigger", room: chosen.index, mode: chosen.mode, before });
        }),
      );
    }
    await wait(4000);
    const records = await snapshot(`cycle-${cycle}`);
    if (
      records.length !== roomCount * 2 ||
      records.some((r) => r.state.status !== "Connected" || r.harnessErrors?.length)
    )
      throw new Error("Connected-player count or harness health failed");
    observeOutcomes(records);
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
  if (
    completions.size !== roomCount ||
    (seconds >= 30 && !recoveries) ||
    (roomCount >= 3 && seconds >= 60 && recoveryModes.size !== 2)
  )
    throw new Error(
      "Missing authoritative finishes or verified recovery; duration alone insufficient",
    );
  success = true;
  log({
    event: "duration-complete",
    elapsedMs: Date.now() - began,
    recoveries,
    recoveryModes: [...recoveryModes],
    completedRounds: Object.fromEntries(
      [...completions].map(([room, rounds]) => [room, [...rounds]]),
    ),
    scope:
      "Load duration completed; metric/visual acceptance still requires independent assessment",
  });
} catch (error) {
  log({ event: "failure", error: error.stack });
  try {
    await captureFailure?.("failure");
  } catch (error) {
    log({ event: "failure-capture-error", error: error.message });
  }
  process.exitCode = 1;
} finally {
  const terminal = [];
  for (const { page, index } of rooms) {
    try {
      const result = await page.evaluate(() => {
        const result = structuredClone({
          states: window.capacity?.clients.map((c) => c.state),
          maxLoopMs: window.capacity?.maxLoopMs,
          errors: window.capacity?.errors,
        });
        clearInterval(window.capacity?.timer);
        for (const c of window.capacity?.clients ?? []) c.leave();
        return result;
      });
      terminal.push({ room: index, ...result });
    } catch (error) {
      terminal.push({ room: index, error: error.message });
    }
  }
  fs.writeFileSync(path.join(output, "agents-final.json"), JSON.stringify(terminal));
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
      const confirm = ui[seat].getByRole("button", { name: "Confirm leave", exact: true });
      if (await confirm.count()) await confirm.click({ timeout: 1000 });
    } catch {}
  }
  await Promise.all(browsers.map((b) => b.close()));
  log({ event: "closed", success, output });
  const manifestPath = path.join(output, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.collectionCompleted = success;
  manifest.endedAt = new Date().toISOString();
  manifest.artifacts = Object.fromEntries(
    fs
      .readdirSync(output)
      .filter((file) => file !== "manifest.json")
      .map((file) => [
        file,
        createHash("sha256")
          .update(fs.readFileSync(path.join(output, file)))
          .digest("hex"),
      ]),
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
