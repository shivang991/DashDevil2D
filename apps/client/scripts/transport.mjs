import fs from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const test = process.argv.includes("--test");
const dense = process.argv.includes("--dense");
const failures = process.argv.includes("--failures");
const responsibility = process.argv.includes("--responsibility");
const rage = process.argv.includes("--rage");
const rageDefault = process.argv.includes("--rage-default");
const groups = process.argv.includes("--groups");
const finality = process.argv.includes("--finality");
const maintenance = process.argv.includes("--maintenance");
const lifecycle = process.argv.includes("--lifecycle");
const boundaries = process.argv.includes("--boundaries");
const hearts = process.argv.includes("--hearts");
const objects = hearts || process.argv.includes("--objects");
const contacts = process.argv.includes("--contacts");
const race = groups || finality || contacts || process.argv.includes("--race");
const rooms =
  dense ||
  failures ||
  responsibility ||
  rage ||
  rageDefault ||
  boundaries ||
  maintenance ||
  lifecycle ||
  objects ||
  race ||
  process.argv.includes("--rooms");
const diagnostic = process.argv.includes("--diagnostic") || (test && !rooms);
const directory = test
  ? fs.mkdtempSync(path.join(os.tmpdir(), "dashdevil-transport-"))
  : path.join(root, ".local/transport");
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const serverDirectory = path.join(root, "apps/server");
function run(command, args, cwd = serverDirectory) {
  const result = spawnSync(command, args, { cwd, env: process.env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
run("go", [
  "run",
  "./cmd/devcert",
  "--dir",
  directory,
  ...(process.argv.includes("--renew") ? ["--renew"] : []),
]);
const configPath = path.join(directory, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
let httpsCert = path.join(directory, "webtransport.pem"),
  httpsKey = path.join(directory, "webtransport-key.pem");
if (!test) {
  const check = spawnSync("mkcert", ["-CAROOT"], { encoding: "utf8" });
  if (check.status !== 0)
    throw new Error(
      "Trusted local HTTPS requires mkcert. Install mkcert, run mkcert -install, then rerun pnpm dev:transport. The test harness uses a certificate-scoped Chrome trust pin only.",
    );
  httpsCert = path.join(directory, "https.pem");
  httpsKey = path.join(directory, "https-key.pem");
  run(
    "mkcert",
    ["-cert-file", httpsCert, "-key-file", httpsKey, "localhost", "127.0.0.1", "::1"],
    root,
  );
}
run("go", ["build", "-o", path.join(directory, "diagnostic-server"), "./cmd/diagnostic"]);
const children = [];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill(test && child === children[0] ? "SIGKILL" : "SIGTERM");
}
function retainEvidence(code) {
  const output = path.join(
    root,
    "apps/client/test-results",
    `transport-${new Date().toISOString().replaceAll(":", "-")}`,
  );
  fs.mkdirSync(output, { recursive: true });
  for (const name of fs.readdirSync(directory)) {
    if (name === "config.json" || name === "server.log" || name.startsWith("browser-"))
      fs.cpSync(path.join(directory, name), path.join(output, name), { recursive: true });
  }
  const revision = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).stdout.trim();
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout;
  const hashes = Object.fromEntries(
    [
      "infra/dense-drag-race.json",
      "infra/dense-road-rage.json",
      "apps/client/tests/browser/dense.spec.ts",
      "infra/failures-drag-race.json",
      "infra/failures-road-rage.json",
      "apps/client/tests/browser/failures.spec.ts",
      "infra/responsibility-track.json",
      "packages/contracts/race/responsibility.json",
      "apps/client/tests/browser/responsibility.spec.ts",
      "apps/client/tests/browser/responsibility.html",
      "apps/server/simulation/contacts.go",
      "apps/client/src/game/RaceSession.ts",
      "infra/road-rage-track.json",
      "packages/contracts/race/road-rage.json",
      "apps/client/tests/browser/road-rage.spec.ts",
      "infra/lifecycle-boundaries.json",
      "apps/client/tests/browser/boundaries.spec.ts",
      "apps/server/transport/rooms.go",
      "apps/server/transport/pair.go",
      "apps/server/transport/server.go",
      "apps/client/tests/browser/groups.spec.ts",
      "infra/finality-track.json",
      "apps/client/tests/browser/finality.spec.ts",
      "packages/simulation/multiplayer.ts",
      "apps/server/simulation/simulation.go",
      "apps/server/simulation/objects.go",
      "apps/client/src/transport/PairedConnection.ts",
      "apps/client/src/screens/MultiplayerScreen.tsx",
      "apps/client/playwright.transport.config.ts",
      "apps/server/go.mod",
      "apps/server/go.sum",
      "apps/server/transport/diagnostic.json",
      "packages/contracts/protocol/fixtures.json",
      "packages/contracts/race/fixtures.json",
      "packages/contracts/race/objects.json",
      "packages/contracts/race/contacts.json",
      "infra/contacts-track.json",
      "infra/hearts-track.json",
      "infra/clear-track.json",
      "packages/contracts/configuration/defaults.json",
      "pnpm-lock.yaml",
    ].map((file) => [
      file,
      createHash("sha256")
        .update(fs.readFileSync(path.join(root, file)))
        .digest("hex"),
    ]),
  );
  const go = spawnSync("go", ["version"], {
    cwd: serverDirectory,
    env: process.env,
    encoding: "utf8",
  }).stdout.trim();
  const pnpm = spawnSync("pnpm", ["--version"], {
    env: process.env,
    encoding: "utf8",
  }).stdout.trim();
  fs.writeFileSync(
    path.join(output, "manifest.json"),
    JSON.stringify(
      {
        version: 1,
        fixture: dense
          ? "validated maximum-speed/density separated state in both modes; bounded native baseline drain and authority reader stall"
          : failures
            ? "validated empty long rounds in both modes; 60s application bandwidth, stalled input writer and paired fresh-control recovery"
            : responsibility
              ? "validated infra/responsibility-track.json; empty track, 6HP, 15s; native contact damage and application-delayed authority reversal"
              : rage
                ? "validated infra/road-rage-track.json: 8s, 6HP, 200-unit slices; mode changes, deadline and rematch"
                : rageDefault
                  ? "shipped default Road Rage; obstacle survival and HP elimination"
                  : boundaries
                    ? "default Drag Race with validated infra/lifecycle-boundaries.json: 2s grace, 2s idle, 1s warning; native room actions and transport loss"
                    : groups
                      ? "validated infra/finality-track.json; 1Hz test tick-boundary finish, pending-group recovery baseline capture"
                      : finality
                        ? "validated infra/clear-track.json; delayed room state, outcome before incomplete recovery baseline, swapped seats"
                        : maintenance
                          ? "default Drag Race; completed and active rooms under a two-second test maintenance deadline"
                          : lifecycle
                            ? "shipped default Drag Race; menu/focus, paired recovery, shared results and reused-connection rematch"
                            : contacts
                              ? "validated infra/contacts-track.json; swept returns, overtaking and persistent tailgating"
                              : objects
                                ? hearts
                                  ? "validated infra/hearts-track.json; reserved heart contention and confirmed finish"
                                  : "shipped default Drag Race configuration; random server seed; obstacles and HP elimination"
                                : race
                                  ? "validated infra/clear-track.json; real room driving and confirmed finish"
                                  : rooms
                                    ? "React private rooms; random server seed; round zero and released controls"
                                    : "current-protocol diagnostic continuation, seed 1, frozen positions 100.125/20000.5, released controls",
        revision,
        dirty,
        worktreeDiffSha256: createHash("sha256")
          .update(
            spawnSync("git", ["diff", "HEAD", "--binary"], {
              cwd: root,
              maxBuffer: 128 * 1024 * 1024,
            }).stdout,
          )
          .digest("hex"),
        hashes,
        go,
        pnpm,
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
        cpu: os.cpus()[0]?.model,
        release: os.release(),
        trust:
          "Chrome process-scoped HTTPS SPKI pin; WebTransport certificate SHA-256 pin; no global trust bypass",
        exitCode: code,
        originalDirectory: directory,
      },
      null,
      2,
    ),
  );
  console.log(`Retained transport evidence: ${output}`);
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stop();
    process.exitCode = 1;
  });
const serverLog = fs.openSync(path.join(directory, "server.log"), "a", 0o600);
const server = spawn(
  path.join(directory, "diagnostic-server"),
  [
    ...(dense
      ? [
          "--drag-race-config",
          path.join(root, "infra/dense-drag-race.json"),
          "--road-rage-config",
          path.join(root, "infra/dense-road-rage.json"),
        ]
      : []),
    ...(failures
      ? [
          "--drag-race-config",
          path.join(root, "infra/failures-drag-race.json"),
          "--road-rage-config",
          path.join(root, "infra/failures-road-rage.json"),
        ]
      : []),
    ...(responsibility
      ? ["--road-rage-config", path.join(root, "infra/responsibility-track.json")]
      : []),
    ...(rage
      ? [
          "--road-rage-config",
          path.join(root, "infra/road-rage-track.json"),
          "--drag-race-config",
          path.join(root, "infra/clear-track.json"),
        ]
      : []),
    ...(maintenance ? ["--admin-address", "127.0.0.1:8444", "--drain-timeout", "2s"] : []),
    ...(diagnostic ? ["--diagnostic"] : []),
    ...(boundaries || hearts || race
      ? [
          "--drag-race-config",
          path.join(
            root,
            boundaries
              ? "infra/lifecycle-boundaries.json"
              : groups
                ? "infra/finality-track.json"
                : hearts
                  ? "infra/hearts-track.json"
                  : contacts
                    ? "infra/contacts-track.json"
                    : "infra/clear-track.json",
          ),
        ]
      : []),
    "--cert",
    httpsCert,
    "--key",
    httpsKey,
    "--quic-cert",
    path.join(directory, "webtransport.pem"),
    "--quic-key",
    path.join(directory, "webtransport-key.pem"),
  ],
  { cwd: root, stdio: ["ignore", serverLog, serverLog] },
);
children.push(server);
const env = {
  ...process.env,
  DASHDEVIL_DENSE_TESTS: dense ? "1" : "",
  DASHDEVIL_FAILURE_TESTS: failures ? "1" : "",
  DASHDEVIL_RESPONSIBILITY_TESTS: responsibility ? "1" : "",
  DASHDEVIL_RAGE_TESTS: rage || rageDefault ? "1" : "",
  DASHDEVIL_RAGE_DEFAULT: rageDefault ? "1" : "",
  DASHDEVIL_BOUNDARY_TESTS: boundaries ? "1" : "",
  DASHDEVIL_GROUP_TESTS: groups ? "1" : "",
  DASHDEVIL_SERVER_LOG: path.join(directory, "server.log"),
  DASHDEVIL_FINALITY_TESTS: finality ? "1" : "",
  DASHDEVIL_MAINTENANCE_TESTS: maintenance ? "1" : "",
  DASHDEVIL_ADMIN_URL: maintenance ? "http://127.0.0.1:8444" : "",
  DASHDEVIL_LIFECYCLE_TESTS: lifecycle ? "1" : "",
  DASHDEVIL_CONTACT_TESTS: contacts ? "1" : "",
  DASHDEVIL_OBJECT_TESTS: objects ? "1" : "",
  DASHDEVIL_HEART_TESTS: hearts ? "1" : "",
  DASHDEVIL_RACE_TESTS: race ? "1" : "",
  DASHDEVIL_ROOM_TESTS: rooms ? "1" : "",
  DASHDEVIL_TRANSPORT_CONFIG: configPath,
  DASHDEVIL_HTTPS_CERT: httpsCert,
  DASHDEVIL_HTTPS_KEY: httpsKey,
};
console.log(`Transport evidence directory: ${directory}`);
console.log(
  `HTTPS ${diagnostic ? "diagnostic page" : "private rooms"}: https://127.0.0.1:4173/${diagnostic ? "transport.html" : ""}; certificate expires ${config.expires}`,
);
if (test) {
  const command = spawn(
    "pnpm",
    ["exec", "playwright", "test", "-c", "playwright.transport.config.ts"],
    { cwd: path.join(root, "apps/client"), env, stdio: "inherit" },
  );
  children.push(command);
  server.on("exit", (code) => {
    if (!stopping) {
      console.error(`Transport server exited early (${code})`);
      command.kill("SIGTERM");
    }
  });
  command.on("exit", (code) => {
    stop();
    retainEvidence(code ?? 1);
    process.exitCode = code ?? 1;
  });
} else {
  const vite = spawn(
    "pnpm",
    ["exec", "vite", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
    { cwd: path.join(root, "apps/client"), env, stdio: "inherit" },
  );
  children.push(vite);
  for (const child of children)
    child.on("exit", () => {
      if (!stopping) {
        stop();
        process.exitCode = 1;
      }
    });
}
// A new invocation renews certificates within two days of expiry. --renew forces
// rotation and restarts both listeners, so old sessions cannot retain a stale pin.
