import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";
const file = process.env.DASHDEVIL_TRANSPORT_CONFIG;
if (!file)
  throw new Error("Run pnpm test:transport so certificates and both listeners are available");
const config = JSON.parse(fs.readFileSync(file, "utf8")) as { spki: string };
const runDirectory = path.join(path.dirname(file), `browser-${Date.now()}`);
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: process.env.DASHDEVIL_DENSE_TESTS
    ? "dense.spec.ts"
    : process.env.DASHDEVIL_FAILURE_TESTS
      ? "failures.spec.ts"
      : process.env.DASHDEVIL_RESPONSIBILITY_TESTS
        ? "responsibility.spec.ts"
        : process.env.DASHDEVIL_RAGE_TESTS
          ? "road-rage.spec.ts"
          : process.env.DASHDEVIL_BOUNDARY_TESTS
            ? "boundaries.spec.ts"
            : process.env.DASHDEVIL_GROUP_TESTS
              ? "groups.spec.ts"
              : process.env.DASHDEVIL_FINALITY_TESTS
                ? "finality.spec.ts"
                : process.env.DASHDEVIL_MAINTENANCE_TESTS
                  ? "maintenance.spec.ts"
                  : process.env.DASHDEVIL_LIFECYCLE_TESTS
                    ? "lifecycle.spec.ts"
                    : process.env.DASHDEVIL_CONTACT_TESTS
                      ? "contacts.spec.ts"
                      : process.env.DASHDEVIL_OBJECT_TESTS
                        ? "objects.spec.ts"
                        : process.env.DASHDEVIL_RACE_TESTS
                          ? "race.spec.ts"
                          : process.env.DASHDEVIL_ROOM_TESTS
                            ? "rooms.spec.ts"
                            : "transport.spec.ts",
  retries: 0,
  workers: 1,
  outputDir: runDirectory,
  reporter: [["list"], ["json", { outputFile: path.join(runDirectory, "results.json") }]],
  use: {
    baseURL: "https://127.0.0.1:4173",
    channel: "chrome",
    // Scope local HTTPS trust to this certificate's public key. WebTransport
    // separately uses its short-lived certificate hash, with no UDP bypass.
    launchOptions: { args: [`--ignore-certificate-errors-spki-list=${config.spki}`] },
    screenshot: "only-on-failure",
    video: "on",
    trace: "off",
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4173 --strictPort",
    url: "https://127.0.0.1:4173/transport.html",
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
  },
});
