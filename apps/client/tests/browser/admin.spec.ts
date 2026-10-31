import { test, expect } from "@playwright/test";
import { loginTestAccount } from "./account-helpers";

test("admin creates, edits, resets and deletes users; normal accounts have no admin entry", async ({
  page,
  browser,
  baseURL,
}, info) => {
  test.setTimeout(60000);
  await page.goto("/");
  await loginTestAccount(page);
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Users" })).toBeVisible();
  await expect(
    page.getByText("Last seen reflects observed authenticated activity, not live presence."),
  ).toBeVisible();
  await page.getByLabel("New username").fill("Panel_Driver");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  const password = await page.getByLabel("Temporary password", { exact: true }).inputValue();
  expect(password.length).toBeGreaterThanOrEqual(12);
  const context = await browser.newContext({ baseURL });
  const driver = await context.newPage();
  try {
    await driver.goto("/");
    await driver.getByRole("button", { name: "Login to play multiplayer" }).click();
    await driver.getByLabel("Username").fill("Panel_Driver");
    await driver.getByLabel("Password", { exact: true }).fill(password);
    await driver.getByRole("button", { name: "Login", exact: true }).click();
    await expect(driver.getByRole("heading", { name: "Change temporary password" })).toBeVisible();
    await driver.getByLabel("New password", { exact: true }).fill("panel replacement password");
    await driver.getByLabel("Confirm new password").fill("panel replacement password");
    await driver.getByRole("button", { name: "Save password" }).click();
    await expect(driver.getByRole("button", { name: /Drag Race/ })).toBeEnabled();
    await expect(driver.getByRole("button", { name: "Admin", exact: true })).toHaveCount(0);
    const row = page.getByRole("row").filter({ hasText: "Panel_Driver" });
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Username", { exact: true }).fill("bad name");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Username must contain");
    await page.getByLabel("Username", { exact: true }).fill("Panel_Renamed");
    await page.getByLabel("Avatar", { exact: true }).setInputFiles({
      name: "avatar.webp",
      mimeType: "image/webp",
      buffer: Buffer.from(
        "UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoCAAIAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=",
        "base64",
      ),
    });
    let release!: () => void;
    const pendingSave = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/account/admin/users/*/profile", async (route) => {
      await pendingSave;
      await route.continue();
    });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Copy password", exact: true })).toBeDisabled();
    release();
    await expect(page.getByRole("status")).toContainText("Profile saved");
    await page.unroute("**/api/account/admin/users/*/profile");
    await page.getByRole("button", { name: "Dismiss password" }).click();
    await expect(page.getByLabel("Temporary password", { exact: true })).toHaveCount(0);
    await driver.reload();
    await expect(driver.getByText("Panel_Renamed", { exact: true })).toBeVisible();
    await page
      .getByRole("row")
      .filter({ hasText: "Panel_Renamed" })
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await page.getByRole("button", { name: "Remove avatar" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Profile saved");
    await info.attach("admin-users", { body: await page.screenshot(), contentType: "image/png" });
    const renamed = page.getByRole("row").filter({ hasText: "Panel_Renamed" });
    await renamed.getByRole("button", { name: "Reset password", exact: true }).click();
    await page.getByRole("button", { name: "Confirm reset", exact: true }).click();
    await expect(page.getByLabel("Temporary password", { exact: true })).toBeVisible();
    await driver.reload();
    await expect(driver.getByRole("button", { name: /Drag Race/ })).toBeDisabled();
    await page.getByRole("button", { name: "Dismiss password" }).click();
    await renamed.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(renamed).toBeVisible();
    await renamed.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Permanently delete", exact: true }).click();
    await expect(page.getByText("Panel_Renamed", { exact: true })).toHaveCount(0);
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: "Test_Driver" })
        .getByRole("button", { name: "Delete", exact: true }),
    ).toBeDisabled();
    await page.reload();
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await expect(page.getByLabel("Temporary password", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("button", { name: /Long Drive/ })).toBeVisible();
  } finally {
    await context.close();
  }
});
