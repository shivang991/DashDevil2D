import { test, expect } from "@playwright/test";

test("guest menu locks multiplayer, opens login and retains Long Drive", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173");
  await expect(page.getByRole("button", { name: /Drag Race/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Road Rage/ })).toBeDisabled();
  await page.getByRole("button", { name: "Login to play multiplayer" }).click();
  await expect(page.getByRole("heading", { name: "Login", exact: true })).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("minlength", "12");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: /Long Drive/ }).click();
  await expect(page.locator("canvas")).toBeVisible();
});
