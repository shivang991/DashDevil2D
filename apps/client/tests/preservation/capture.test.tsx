import { test, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createCaptureRun } from "../browser/capture";
const temporary: string[] = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});
test("capture result keeps earlier runs and identifies the actual tested source and bytes", () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dashdevil-capture-test-"));
  temporary.push(outputRoot);
  const repositoryRoot = path.resolve("../..");
  const expectedRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const options = {
    outputRoot,
    repositoryRoot,
    fixtureVersion: 1,
    fixtures: ["apps/client/tests/browser/baseline.spec.ts"],
    configuration: ["apps/client/src/lib/constants.ts", "apps/client/playwright.config.ts"],
  };
  const first = createCaptureRun(options);
  fs.writeFileSync(
    first.artifactPath("environment.json"),
    JSON.stringify({ viewport: { width: 1280, height: 900 }, browser: "fixture browser" }),
  );
  fs.writeFileSync(first.artifactPath("screen.bin"), "original pixels");
  first.finalize({ status: "failed" });
  const originalManifest = fs.readFileSync(first.artifactPath("manifest.json"), "utf8");
  const second = createCaptureRun(options);
  fs.writeFileSync(second.artifactPath("screen.bin"), "retry pixels");
  second.finalize({ status: "passed" });
  expect(second.directory).not.toBe(first.directory);
  expect(fs.readFileSync(first.artifactPath("screen.bin"), "utf8")).toBe("original pixels");
  expect(fs.readFileSync(first.artifactPath("manifest.json"), "utf8")).toBe(originalManifest);
  const manifest = JSON.parse(fs.readFileSync(second.artifactPath("manifest.json"), "utf8"));
  expect(manifest.provenance.testedRevision).toBe(expectedRevision);
  expect(manifest.provenance.fixtureVersion).toBe(1);
  expect(manifest.provenance.trackedWorktreeDiffSha256).toBe(
    createHash("sha256")
      .update(
        execFileSync("git", ["diff", "HEAD", "--binary"], {
          cwd: repositoryRoot,
          maxBuffer: 128 * 1024 * 1024,
        }),
      )
      .digest("hex"),
  );
  expect(manifest.provenance.configuration["apps/client/src/lib/constants.ts"]).toEqual({
    sha256: createHash("sha256")
      .update(fs.readFileSync(path.join(repositoryRoot, "apps/client/src/lib/constants.ts")))
      .digest("hex"),
  });
  expect(manifest.artifacts["screen.bin"]).toEqual({
    bytes: 12,
    sha256: createHash("sha256").update("retry pixels").digest("hex"),
  });
  expect(manifest.result.status).toBe("passed");
});
test("capture provenance accepts a dirty asset patch larger than the process stdout buffer", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dashdevil-large-capture-"));
  temporary.push(temporaryRoot);
  const repositoryRoot = path.join(temporaryRoot, "repository");
  fs.mkdirSync(repositoryRoot);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repositoryRoot, maxBuffer: 8 * 1024 * 1024 });
  git("init", "--quiet");
  fs.writeFileSync(path.join(repositoryRoot, "config.json"), '{"fixture":1}');
  fs.writeFileSync(path.join(repositoryRoot, "asset.txt"), "original asset\n");
  git("add", "config.json", "asset.txt");
  git(
    "-c",
    "user.name=Capture test",
    "-c",
    "user.email=capture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  );
  fs.writeFileSync(path.join(repositoryRoot, "asset.txt"), "changed asset\n".repeat(200000));
  const patch = git("diff", "HEAD", "--binary");
  expect(patch.length).toBeGreaterThan(1024 * 1024);
  const capture = createCaptureRun({
    outputRoot: path.join(temporaryRoot, "outputs"),
    repositoryRoot,
    fixtureVersion: 1,
    fixtures: ["config.json"],
    configuration: ["config.json"],
  });
  fs.writeFileSync(capture.artifactPath("observation.json"), '{"captured":true}');
  capture.finalize({ status: "passed" });
  const manifest = JSON.parse(fs.readFileSync(capture.artifactPath("manifest.json"), "utf8"));
  expect(manifest.provenance.trackedWorktreeDiffSha256).toBe(
    createHash("sha256").update(patch).digest("hex"),
  );
  expect(manifest.provenance.worktreeStatus).toContain("M asset.txt");
});
