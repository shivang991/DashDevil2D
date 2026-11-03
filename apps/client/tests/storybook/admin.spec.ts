import { expect, test } from "@playwright/test";

for (const width of [1280, 320]) {
  test(`Admin directory works at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/iframe.html?id=screens-admin--users&viewMode=story");
    await expect(page.getByText("Driver_01", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const directoryScreenshot = info.outputPath(`admin-directory-${width}.png`);
    await page.screenshot({ path: directoryScreenshot });
    await info.attach(`admin-directory-${width}`, {
      path: directoryScreenshot,
      contentType: "image/png",
    });
    const edit = page.getByRole("button", { name: "Edit Driver_01", exact: true });
    await edit.click();
    await expect(page.getByRole("dialog")).toBeInViewport();
    await expect(page.getByLabel("Avatar", { exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(edit).toBeFocused();
    await page.getByRole("button", { name: "Create user", exact: true }).click();
    await expect(page.getByLabel("New username")).toBeFocused();
    const createScreenshot = info.outputPath(`admin-create-${width}.png`);
    await page.screenshot({ path: createScreenshot });
    await info.attach(`admin-create-${width}`, {
      path: createScreenshot,
      contentType: "image/png",
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Create user", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "More actions for Driver_02" }).click();
    await page.getByRole("menuitem", { name: "Delete user" }).click();
    await expect(page.getByRole("alertdialog")).toBeInViewport();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("Driver_02", { exact: true })).toBeVisible();
  });
}
