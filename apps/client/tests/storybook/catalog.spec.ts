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

for (const width of [320, 639, 640, 1280]) {
  test(`Multiplayer identity and player layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/iframe.html?id=screens-multiplayer--entry&viewMode=story");
    const avatar = page.getByLabel("Driver 01 avatar");
    await expect(avatar).toBeVisible();
    const identity = (await avatar.boundingBox())!;
    const modes = (await page.getByRole("group", { name: "Multiplayer mode" }).boundingBox())!;
    expect(identity.y + identity.height).toBeLessThanOrEqual(modes.y);
    await page.goto("/iframe.html?id=screens-multiplayer--guest&viewMode=story");
    const players = page.getByRole("list", { name: "Players" }).getByRole("listitem");
    const first = (await players.nth(0).boundingBox())!;
    const second = (await players.nth(1).boundingBox())!;
    if (width < 640) expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    else expect(second.y + second.height / 2).toBeCloseTo(first.y + first.height / 2, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}

test("Failed join closes at 500ms then shows error for 2 seconds", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:00Z"));
  await page.goto("/iframe.html?id=screens-multiplayer--join-error&viewMode=story");
  await page.getByRole("button", { name: "Join Room" }).click();
  const dialog = page.getByRole("dialog", { name: "Join room", exact: true });
  await expect(dialog.getByLabel("Room code")).toBeVisible();
  await dialog.getByLabel("Room code").fill("1234");
  await dialog.getByRole("button", { name: "Join Room" }).click();
  await page.clock.runFor(100);
  await expect(page.getByRole("dialog", { name: "Join room", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.clock.runFor(499);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.clock.runFor(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveText("Unable to join: room is full.");
  await page.clock.runFor(1999);
  await expect(page.getByRole("alert")).toBeVisible();
  await page.clock.runFor(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const story of ["error", "countdown-cancelled"]) {
  test(`Stable timed multiplayer error: ${story}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 1100 });
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-01T00:00:00Z"));
    await page.goto(`/iframe.html?id=screens-multiplayer--${story}&viewMode=story`);
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert.locator("svg")).toHaveCount(1);
    const buttons = page.getByRole("button");
    const before = await buttons.evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      }),
    );
    await page.clock.runFor(1999);
    await expect(alert).toBeVisible();
    await page.clock.runFor(1);
    await expect(alert).toHaveCount(0);
    expect(
      await buttons.evaluateAll((nodes) =>
        nodes.map((node) => {
          const r = node.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height];
        }),
      ),
    ).toEqual(before);
  });
}

test("Race Pause menu, sound, resume, leave and HUD alignment", async ({ page }) => {
  await page.goto("/iframe.html?id=screens-multiplayer--playing-drag-race&viewMode=story");
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  await expect(pause).toBeVisible();
  const indicator = (await page.getByTestId("distance-remaining").boundingBox())!;
  const icon = (await pause.boundingBox())!;
  expect(indicator.x + indicator.width).toBeCloseTo(icon.x + icon.width, 0);
  await pause.click();
  const menu = page.getByRole("dialog", { name: "Race menu" });
  await expect(menu.getByRole("button", { name: "Resume" })).toBeFocused();
  await menu.getByRole("button", { name: "Enable sound" }).click();
  await expect(menu.getByRole("button", { name: "Mute sound" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await menu.getByRole("button", { name: "Resume" }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Multiplayer race" })).toBeFocused();
  await pause.click();
  await menu.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Leave room?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(menu).toBeVisible();
});

test("Race reconnect banner is concise", async ({ page }) => {
  await page.goto("/iframe.html?id=screens-multiplayer--playing-reconnecting&viewMode=story");
  await expect(page.getByRole("alert")).toHaveText("Reconnecting");
});

test("Ready guest can cancel through Waiting for host button", async ({ page }) => {
  await page.goto("/iframe.html?id=screens-multiplayer--guest-readiness-toggle&viewMode=story");
  await page.getByRole("button", { name: "Waiting for host.", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ready", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Ready", exact: true }).click();
  await expect(page.getByRole("button", { name: "Waiting for host.", exact: true })).toBeEnabled();
  await expect(page.getByText("Both players must be connected and ready to start.")).toHaveCount(0);
});

test("Round progresses through menu while driving requires a fresh press", async ({ page }) => {
  await page.goto("/iframe.html?id=screens-multiplayer--advancing-race&viewMode=story");
  const race = page.getByRole("img", { name: "Multiplayer race" });
  await race.focus();
  await page.keyboard.down("ArrowUp");
  await expect(page.getByTestId("nos-status")).toHaveAttribute("data-nos-state", "active");
  await page.keyboard.press("Escape");
  const menu = page.getByRole("dialog", { name: "Race menu" });
  await expect(menu).toBeVisible();
  await expect(page.getByTestId("nos-status")).toHaveAttribute("data-nos-state", "ready");
  const before = await page.getByTestId("time-remaining").textContent();
  await expect(page.getByTestId("time-remaining")).not.toHaveText(before!);
  await menu.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByTestId("nos-status")).toHaveAttribute("data-nos-state", "ready");
  await page.keyboard.up("ArrowUp");
  await page.keyboard.down("ArrowUp");
  await expect(page.getByTestId("nos-status")).toHaveAttribute("data-nos-state", "active");
  await page.keyboard.up("ArrowUp");
});
