import { expect, test } from "@playwright/test";

for (const name of ["Profile", "Race History"]) {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 320, height: 320 },
  ]) {
    test(`${name} controlled dialog fits ${viewport.width}x${viewport.height} and restores focus`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/iframe.html?id=screens-menu--default&viewMode=story");
      const trigger = page.getByRole("button", { name: "Account menu" });
      const open = async () => {
        await trigger.click();
        await page.getByRole("menuitem", { name, exact: true }).click();
      };
      await open();
      const dialog = page.getByRole("dialog", { name, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleDescription(
        name === "Profile"
          ? "Manage your avatar and password."
          : "Your completed races, newest first.",
      );
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(
        await dialog.getByRole("heading").evaluate((node) => getComputedStyle(node).textAlign),
      ).toBe("center");
      const enabled = dialog.locator("button:visible:enabled");
      const first = enabled.first();
      const close = dialog.getByRole("button", { name: "Close", exact: true });
      await close.focus();
      await page.keyboard.press("Tab");
      await expect(first).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(close).toBeFocused();
      await expect(close).toBeInViewport();
      expect(await close.evaluate((node) => getComputedStyle(node).transitionDuration)).toBe("0s");
      if (viewport.height === 320) {
        expect(
          await dialog.evaluate((node) =>
            [...node.querySelectorAll("*")].some(
              (element) =>
                element.scrollHeight > element.clientHeight &&
                getComputedStyle(element).overflowY === "auto",
            ),
          ),
        ).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await open();
      await page.locator(".fixed.inset-0[data-state=open]").click({ position: { x: 2, y: 2 } });
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await open();
      await close.click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }
}

test("Profile saving blocks Close, Escape and outside dismissal", async ({ page }) => {
  await page.goto("/iframe.html?id=screens-profile--saving-password&viewMode=story");
  const dialog = page.getByRole("dialog", { name: "Change password", exact: true });
  await expect(dialog.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.locator(".fixed.inset-0[data-state=open]").click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeVisible();
});
