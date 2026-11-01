import { expect, type Page } from "@playwright/test";

/** Every browser context obtains its own real, server-validated session. */
export async function loginTestAccount(page: Page) {
  const login = page.getByRole("button", { name: "Login to play multiplayer" });
  await expect(login).toBeVisible();
  await login.click();
  await page.getByLabel("Username").fill("Test_Driver");
  const password = process.env.DASHDEVIL_TEST_ACCOUNT_PASSWORD;
  if (!password) throw new Error("Run through the transport test harness");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("button", { name: /Drag Race/ })).toBeEnabled();
}
