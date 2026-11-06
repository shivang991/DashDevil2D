import { test, expect } from "@playwright/test";
import { loginTestAccount } from "./account-helpers";

test.describe.configure({ mode: "serial" });

test("temporary admin changes password, plays with an independent session, then logout forfeits every tab of only that session", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(60000);
  const contexts = await Promise.all([
    browser.newContext({ baseURL }),
    browser.newContext({ baseURL }),
  ]);
  const [host, guest] = await Promise.all(contexts.map((context) => context.newPage()));
  try {
    await host.goto("/");
    await expect(host.getByRole("button", { name: /Drag Race/ })).toBeDisabled();
    await host.getByRole("button", { name: "Login to play multiplayer" }).click();
    await host.getByLabel("Username").fill("test_driver");
    const temporary = process.env.DASHDEVIL_TEST_ACCOUNT_PASSWORD!;
    await host.getByLabel("Password", { exact: true }).fill(temporary);
    await host.getByRole("button", { name: "Login", exact: true }).click();
    await expect(host.getByRole("heading", { name: "Change temporary password" })).toBeVisible();
    await host.reload();
    await expect(host.getByRole("heading", { name: "Change temporary password" })).toBeVisible();
    const password = `${temporary} changed with spaces`;
    await host.getByLabel("New password", { exact: true }).fill(password);
    await host.getByLabel("Confirm new password").fill("different password");
    await host.getByRole("button", { name: "Save password" }).click();
    await expect(host.getByRole("alert")).toHaveText("Passwords do not match");
    await host.getByLabel("Confirm new password").fill(password);
    await host.getByRole("button", { name: "Save password" }).click();
    await expect(host.getByRole("button", { name: /Drag Race/ })).toBeEnabled();
    process.env.DASHDEVIL_TEST_ACCOUNT_PASSWORD = password;
    await host.reload();
    await expect(host.getByRole("button", { name: /Drag Race/ })).toBeEnabled();
    await expect(host.getByText("Test_Driver", { exact: true })).toBeVisible();
    await expect(host.getByRole("button", { name: "Open chat" })).toBeEnabled();
    await info.attach("authenticated-menu", {
      body: await host.screenshot(),
      contentType: "image/png",
    });
    await guest.goto("/");
    await loginTestAccount(guest);
    await host.getByRole("button", { name: /Drag Race/ }).click();
    await host.getByRole("button", { name: "Create Room", exact: true }).click();
    await expect(host.getByTestId("room-code")).toHaveText(/^\d{4}$/);
    const code = await host.getByTestId("room-code").innerText();
    await guest.getByRole("button", { name: /Drag Race/ }).click();
    await guest.getByRole("button", { name: "Join Room", exact: true }).click();
    await guest.getByLabel("Room code").fill(code);
    await guest.getByLabel("Room code").press("Enter");
    for (const page of [host, guest]) {
      await expect(page.getByTestId("room-code")).toHaveText(/^\d{4}$/);
      await expect(page.getByText("Test_Driver (You)", { exact: true })).toBeVisible();
    }
    await host.getByRole("button", { name: "Ready", exact: true }).click();
    await expect(guest.getByRole("img", { name: "Ready", exact: true })).toBeVisible();
    await guest.getByRole("button", { name: "Ready", exact: true }).click();
    await host.getByRole("button", { name: "Start round" }).click();
    for (const page of [host, guest]) {
      await expect(page.getByRole("img", { name: "Multiplayer race" })).toBeVisible();
      await expect
        .poll(async () => Number(await page.getByTestId("round-time").textContent()))
        .toBeGreaterThan(0);
    }
    const logout = await contexts[0].newPage();
    await logout.goto("/");
    await logout.getByRole("button", { name: "Account menu" }).click();
    await logout.getByRole("menuitem", { name: "Profile", exact: true }).click();
    await expect(
      logout.getByRole("dialog").getByText("Test_Driver", { exact: true }),
    ).toBeVisible();
    await logout.getByRole("button", { name: "Close", exact: true }).click();
    await expect(logout.getByRole("dialog")).toHaveCount(0);
    await logout.getByRole("button", { name: "Account menu" }).click();
    await logout.getByRole("menuitem", { name: "Logout", exact: true }).click();
    for (const page of [host, logout]) {
      await expect(page.getByRole("button", { name: /Drag Race/ })).toBeDisabled();
      expect(
        await page.evaluate(() =>
          Object.keys(sessionStorage).filter((key) => key.startsWith("dashdevil-seat:")),
        ),
      ).toEqual([]);
    }
    await expect(guest.getByRole("dialog")).toContainText("Round Over", { timeout: 10000 });
    await expect(guest.getByRole("dialog")).toContainText(/won|win|victory/i);
    await guest.getByRole("button", { name: "Return to Lobby", exact: true }).click();
    await guest.getByRole("button", { name: "Leave", exact: true }).click();
    const confirm = guest.getByRole("button", { name: "Confirm leave", exact: true });
    if (await confirm.isVisible()) await confirm.click();
    await guest.getByRole("button", { name: "Back", exact: true }).click();
    await expect(guest.getByRole("button", { name: /Drag Race/ })).toBeEnabled();
    await info.attach("guest-after-logout", {
      body: await host.screenshot(),
      contentType: "image/png",
    });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("avatar edits compress oversized sources, save explicitly, discard on Escape and retain errors", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/");
  await loginTestAccount(page);
  const otherContext = await browser.newContext({ baseURL });
  const other = await otherContext.newPage();
  await other.goto("/");
  await loginTestAccount(other);
  const trigger = page.getByRole("button", { name: "Account menu" });
  async function openProfile() {
    await trigger.click();
    await page.getByRole("menuitem", { name: "Profile", exact: true }).click();
  }
  await openProfile();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Test_Driver", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Logout", exact: true })).toHaveCount(0);
  // A real decoded image over 2 MB verifies browser compression before the API.
  const sharp = (await import("sharp")).default;
  const source = await sharp({
    create: { width: 1200, height: 1200, channels: 4, background: "red" },
  })
    .png()
    .toBuffer();
  const oversized = Buffer.concat([source, Buffer.alloc(2 * 1024 * 1024)]);
  const upload = async () => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Change avatar" }).focus();
    await page.keyboard.press("Enter");
    await (await chooser).setFiles({ name: "large.png", mimeType: "image/png", buffer: oversized });
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  };
  await upload();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await openProfile();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  await expect(dialog.locator("img")).toHaveCount(0);
  await upload();
  await page.route("**/api/account/profile", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unable to save. Try again" }),
    }),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Unable to save. Try again");
  await page.unroute("**/api/account/profile");
  const savedRequest = page.waitForRequest("**/api/account/profile");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const payload = (await savedRequest).postDataJSON();
  expect(payload.username).toBeUndefined();
  const output = Buffer.from(payload.avatar, "base64");
  expect(output.length).toBeLessThanOrEqual(512 * 1024);
  const metadata = await sharp(output).metadata();
  expect(metadata.width).toBeLessThanOrEqual(512);
  expect(metadata.height).toBeLessThanOrEqual(512);
  await expect(page.getByRole("button", { name: "Change password", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog").locator("img")).toBeVisible();
  await test
    .info()
    .attach("saved-profile", { body: await page.screenshot(), contentType: "image/png" });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await expect(page.getByText("Test_Driver", { exact: true })).toBeVisible();
  await expect(page.locator("img")).toBeVisible();
  await openProfile();
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  const previousPassword = process.env.DASHDEVIL_TEST_ACCOUNT_PASSWORD!;
  const newPassword = `${previousPassword} profile`;
  await page.getByLabel("Current password", { exact: true }).fill("wrong password");
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Save password", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Current password is incorrect");
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue(newPassword);
  await page.getByLabel("Current password", { exact: true }).fill(previousPassword);
  await page.getByRole("button", { name: "Save password", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Password changed");
  process.env.DASHDEVIL_TEST_ACCOUNT_PASSWORD = newPassword;
  await other.reload();
  await expect(other.getByRole("button", { name: /Drag Race/ })).toBeDisabled();
  await otherContext.close();
  await page.getByRole("button", { name: "Remove avatar", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog").locator("img")).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await trigger.click();
  await page.getByRole("menuitem", { name: "Logout", exact: true }).click();
  await page.getByRole("button", { name: "Login to play multiplayer" }).click();
  await page.getByLabel("Username", { exact: true }).fill("Test_Driver");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DASHDEVIL_TEST_ACCOUNT_PASSWORD!);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("button", { name: /Drag Race/ })).toBeEnabled();
});
