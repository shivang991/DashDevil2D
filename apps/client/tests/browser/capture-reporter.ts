import type { FullConfig, FullResult, Reporter } from "@playwright/test/reporter";
import { writeCaptureManifest } from "./capture";
export default class CaptureReporter implements Reporter {
  private directory?: string;
  private provenance?: unknown;
  private result?: FullResult;
  onBegin(config: FullConfig) {
    // Playwright may evaluate configuration more than once. The resolved run
    // configuration is the authority for where its workers actually wrote.
    this.directory = config.projects[0].outputDir;
    this.provenance = config.metadata.captureProvenance;
  }
  onEnd(result: FullResult) {
    this.result = result;
  }
  onExit() {
    if (!this.directory || !this.result) throw new Error("Capture reporter has no completed run");
    writeCaptureManifest(this.directory, this.provenance, {
      status: this.result.status,
      startedAt: this.result.startTime.toISOString(),
      durationMs: this.result.duration,
    });
  }
}
