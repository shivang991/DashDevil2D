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
      return new Promise<Result>((resolve, reject) => {
        channel.on("playFunctionThrewException", (error) =>
          reject(new Error(JSON.stringify(error))),
        );
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

for (const width of [1280, 320]) {
  test(`Account dropdown overlays games at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/iframe.html?id=screens-menu--default&viewMode=story");
    const trigger = page.getByRole("button", { name: "Account menu" });
    const games = ["Long Drive", "Drag Race", "Road Rage"].map((name) =>
      page.getByRole("button", { name: new RegExp(name) }),
    );
    await expect(trigger).toBeVisible();
    const before = await Promise.all(games.map((game) => game.boundingBox()));
    await trigger.click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    expect(await Promise.all(games.map((game) => game.boundingBox()))).toEqual(before);
    const menuBox = (await menu.boundingBox())!;
    const triggerBox = (await trigger.boundingBox())!;
    expect(menuBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height);
    expect(menuBox.x + menuBox.width).toBeCloseTo(triggerBox.x + triggerBox.width, 0);
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width);
    for (const name of ["Profile", "Race History", "Logout"]) {
      await expect(page.getByRole("menuitem", { name })).toBeInViewport();
    }
    await test
      .info()
      .attach(`account-menu-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole("heading", { name: "Branding" }).click();
    await expect(menu).toHaveCount(0);
  });
}

for (const width of [1280, 320]) {
  test(`Profile layout and keyboard avatar picker at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/iframe.html?id=screens-profile--open&viewMode=story");
    const dialog = page.getByRole("dialog", { name: "Profile" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
    const pencil = dialog.getByRole("button", { name: "Change avatar" });
    const avatar = dialog.getByLabel("Driver_01 avatar");
    const username = dialog.getByText("Driver_01", { exact: true });
    const avatarBox = (await avatar.boundingBox())!;
    const pencilBox = (await pencil.boundingBox())!;
    const usernameBox = (await username.boundingBox())!;
    expect(pencilBox.x).toBeGreaterThan(avatarBox.x + avatarBox.width / 2);
    expect(pencilBox.y).toBeLessThan(avatarBox.y + avatarBox.height / 2);
    expect(usernameBox.y).toBeGreaterThanOrEqual(avatarBox.y + avatarBox.height);
    for (const control of [
      pencil,
      dialog.getByRole("button", { name: "Change password" }),
      dialog.getByRole("button", { name: "Close" }),
    ]) {
      await expect(control).toBeInViewport();
      expect(
        await control.evaluate((element) => getComputedStyle(element).transitionDuration),
      ).toBe("0s");
    }
    await pencil.focus();
    const chooser = page.waitForEvent("filechooser");
    await page.keyboard.press("Enter");
    await (await chooser).setFiles([]);
    await expect(dialog.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
    await test.info().attach(`profile-${width}`, {
      body: await page.screenshot({ path: test.info().outputPath(`profile-${width}.png`) }),
      contentType: "image/png",
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeFocused();
  });
}
