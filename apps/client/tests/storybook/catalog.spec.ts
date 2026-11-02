import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Test the built catalog, including each story's play function, without a game server.
const { entries } = JSON.parse(
  readFileSync(new URL("../../storybook-static/index.json", import.meta.url), "utf8"),
) as { entries: Record<string, { id: string; type: string; title: string; name: string }> };

for (const story of Object.values(entries).filter((entry) => entry.type === "story")) {
  test(`${story.title} / ${story.name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(/\/(__transport-config|api\/account)(\/|\?|$)/, (route) => {
      errors.push(`Unexpected server request: ${route.request().url()}`);
      return route.abort();
    });
    await page.goto("/iframe.html");
    await page.waitForFunction(() => "__STORYBOOK_ADDONS_CHANNEL__" in window);
    const result = await page.evaluate((storyId) => {
      type Result = { storyId: string; status: string };
      const channel = (
        window as unknown as {
          __STORYBOOK_ADDONS_CHANNEL__: {
            on: (event: string, listener: (result: Result) => void) => void;
            emit: (event: string, value: object) => void;
          };
        }
      ).__STORYBOOK_ADDONS_CHANNEL__;
      return new Promise<Result>((resolve) => {
        channel.on("storyFinished", (result) => {
          if (result.storyId === storyId) resolve(result);
        });
        channel.emit("setCurrentStory", { storyId, viewMode: "story" });
      });
    }, story.id);
    expect(result.status).toBe("success");
    await expect(page.locator("#storybook-root > *").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
