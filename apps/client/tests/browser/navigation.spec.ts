import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:4173";

test("multiplayer deep links, mode history, refresh and unknown URLs", async ({ page }) => {
  await page.goto(`${origin}/multiplayer/road-rage`);
  await expect(page.getByTestId("selected-mode")).toHaveText("Road Rage");
  await page.getByRole("button", { name: "Drag Race", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/multiplayer/drag-race`);
  await page.goBack();
  await expect(page.getByTestId("selected-mode")).toHaveText("Road Rage");
  await page.goForward();
  await expect(page.getByTestId("selected-mode")).toHaveText("Drag Race");
  await page.reload();
  await expect(page.getByTestId("selected-mode")).toHaveText("Drag Race");
  await page.goto(`${origin}/unknown`);
  await expect(page).toHaveURL(`${origin}/`);
  await expect(page.getByRole("button", { name: /Long Drive/ })).toBeVisible();
});

test("solo Back cancellation preserves run; confirmation ends it; reload starts fresh", async ({
  page,
}) => {
  await page.goto(origin);
  await page.getByRole("button", { name: /Long Drive/ }).click();
  await expect(page).toHaveURL(`${origin}/long-drive`);
  await expect(page.locator("canvas")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "End run?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/long-drive`);
  await expect(page.locator("canvas")).toBeVisible();
  await page.goBack();
  await page.getByRole("button", { name: "End run", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/`);
  await page.goForward();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Back to Menu", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Game settings" })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(`${origin}/long-drive`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("canvas")).toBeVisible();
});

test("browser Back restores the saved sound setting on menu", async ({ page }) => {
  await page.goto(origin);
  await page.getByRole("button", { name: /Long Drive/ }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Mute sound", exact: true }).click();
  await page.goBack();
  await page.getByRole("button", { name: "End run", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enable sound", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Enable sound", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mute sound", exact: true })).toBeVisible();
});
