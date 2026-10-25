import { test as base } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
export const test = base.extend<{ evidence: string }>({
  evidence: async ({ browser }, provideEvidence, testInfo) => {
    const directory = testInfo.outputPath("evidence");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, "scenario-environment.json"),
      JSON.stringify(
        {
          provenance: testInfo.config.metadata.captureProvenance,
          scenario: testInfo.title,
          browser: browser.version(),
          viewport: testInfo.project.use.viewport,
        },
        null,
        2,
      ),
    );
    await provideEvidence(directory);
  },
});
