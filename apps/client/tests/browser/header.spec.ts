import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:4173";

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`global header and chat fit ${viewport.width}px viewport`, async ({ browser }) => {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    try {
      await page.route("**/__transport-config", (route) =>
        route.fulfill({ json: { server: origin } }),
      );
      await page.route("**/api/account", (route) =>
        route.fulfill({
          json: {
            id: 1,
            username: "Driver",
            admin: true,
            mustChangePassword: false,
            expires: "2099-01-01",
          },
        }),
      );
      await page.route("**/api/account/chat/sync", (route) =>
        route.fulfill({
          json: {
            self: 1,
            selected: null,
            pinned: null,
            acquaintances: [],
            suggested: [],
            unread: 2,
          },
        }),
      );
      await page.goto(origin);
      const header = page.getByRole("banner", { name: "App controls" });
      const sound = header.getByRole("button", { name: "Mute sound" });
      const chat = header.getByRole("button", { name: "Open chat" });
      await expect(chat).toBeEnabled();
      await expect(chat).toContainText("2");
      const bounds = (await header.boundingBox())!;
      expect(bounds.y).toBe(0);
      expect(bounds.height).toBe(48);
      expect(bounds.width).toBe(viewport.width);
      expect((await sound.boundingBox())!.x).toBeLessThan((await chat.boundingBox())!.x);
      await sound.click();
      await expect(header.getByRole("button", { name: "Enable sound" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await chat.click();
      const panel = page.getByRole("complementary", { name: "Chat" });
      await expect(panel).toBeVisible();
      const panelBounds = (await panel.boundingBox())!;
      expect(panelBounds.y).toBeGreaterThanOrEqual(48);
      expect(panelBounds.x + panelBounds.width).toBeLessThanOrEqual(viewport.width);
      await header.getByRole("button", { name: "Hide chat" }).click();
      await expect(panel).toHaveCount(0);
      for (const path of [
        "/login",
        "/admin",
        "/multiplayer/drag-race",
        "/multiplayer/road-rage",
        "/long-drive",
      ]) {
        await page.goto(`${origin}${path}`);
        await expect(header).toBeVisible();
        await expect(header.getByRole("button", { name: "Enable sound" })).toBeVisible();
      }
      await expect(header.getByRole("button", { name: "Open chat" })).toBeDisabled();
      const canvasBounds = (await page.locator("canvas").boundingBox())!;
      expect(canvasBounds.y).toBeGreaterThanOrEqual(48);
      expect(canvasBounds.y + canvasBounds.height).toBeLessThanOrEqual(viewport.height);
    } finally {
      await context.close();
    }
  });
}

test("guest header keeps disabled chat visible", async ({ page }) => {
  await page.goto(origin);
  await expect(
    page.getByRole("banner", { name: "App controls" }).getByRole("button", { name: "Open chat" }),
  ).toBeDisabled();
});
