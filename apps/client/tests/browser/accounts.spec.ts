import { test, expect } from "@playwright/test";
import { loginTestAccount } from "./account-helpers";

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
    await expect(host.getByRole("button", { name: /Chat/ })).toBeDisabled();
    await info.attach("authenticated-menu", {
      body: await host.screenshot(),
      contentType: "image/png",
    });
    await guest.goto("/");
    await loginTestAccount(guest);
    await host.getByRole("button", { name: /Drag Race/ }).click();
    await host.getByRole("button", { name: "Create Room", exact: true }).click();
    await expect(host.getByTestId("connection-state")).toHaveText("Connected");
    const code = await host.getByTestId("room-code").innerText();
    await guest.getByRole("button", { name: /Drag Race/ }).click();
    await guest.getByRole("button", { name: "Join Room", exact: true }).click();
    await guest.getByLabel("Room code").fill(code);
    await guest.getByLabel("Room code").press("Enter");
    for (const page of [host, guest]) {
      await expect(page.getByTestId("connection-state")).toHaveText("Connected");
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
    await logout.getByRole("button", { name: "Profile", exact: true }).click();
    await expect(logout.getByRole("dialog")).toContainText("Test_Driver");
    await logout.getByRole("button", { name: "Close", exact: true }).click();
    await expect(logout.getByRole("dialog")).toHaveCount(0);
    await logout.getByRole("button", { name: "Profile", exact: true }).click();
    await logout.getByRole("button", { name: "Logout", exact: true }).click();
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
