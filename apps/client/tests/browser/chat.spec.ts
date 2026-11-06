import { test, expect } from "@playwright/test";
import { loginTestAccount } from "./account-helpers";

test("persistent DMs, unread, responsive panel and Long Drive visibility", async ({
  page,
  browser,
  baseURL,
}, info) => {
  test.setTimeout(90000);
  await page.goto("/");
  await loginTestAccount(page);
  const created = await page.evaluate(async () => {
    const config = await (await fetch("/__transport-config")).json();
    const response = await fetch(`${config.server}/api/account/admin/users`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Chat_Opponent" }),
    });
    return response.json();
  });
  const context = await browser.newContext({ baseURL });
  const peer = await context.newPage();
  try {
    await peer.goto("/");
    await peer.getByRole("button", { name: "Login to play multiplayer" }).click();
    await peer.getByLabel("Username", { exact: true }).fill("Chat_Opponent");
    await peer.getByLabel("Password", { exact: true }).fill(created.temporaryPassword);
    await peer.getByRole("button", { name: "Login", exact: true }).click();
    await peer.getByLabel("New password", { exact: true }).fill("replacement password");
    await peer.getByLabel("Confirm new password").fill("replacement password");
    await peer.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByRole("complementary", { name: "Chat" })).toHaveCount(0);
    await page.getByRole("button", { name: /Open chat/ }).click();
    await page.getByLabel("Search accounts").fill("chat_oppo");
    await page.getByRole("button", { name: /Open conversation with Chat_Opponent/ }).click();
    await expect(page.getByText("No messages yet.")).toBeVisible();
    // Empty conversations still refresh identity; no exchanged message is required.
    for (const username of ["Chat_Renamed", "Chat_Opponent"]) {
      await page.evaluate(
        async ({ id, username }) => {
          const { server } = await (await fetch("/__transport-config")).json();
          await fetch(`${server}/api/account/admin/users/${id}/profile`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username }),
          });
        },
        { id: created.user.id, username },
      );
      await expect(
        page.getByRole("complementary", { name: "Chat" }).getByText(username, { exact: true }),
      ).toBeVisible();
    }

    await expect(peer.getByRole("button", { name: /Open chat/ })).not.toContainText("1");
    await page.getByLabel("Message", { exact: true }).fill("Hello from the menu");
    await page.getByLabel("Message", { exact: true }).press("Enter");
    await expect(page.getByText("Hello from the menu", { exact: true })).toBeVisible();
    await expect(peer.getByRole("button", { name: /Open chat/ })).toContainText("1");
    await peer.bringToFront();
    await peer.getByRole("button", { name: /Open chat/ }).click();
    await peer.getByRole("button", { name: /Open conversation with Test_Driver/ }).click();
    await expect(peer.getByText("Hello from the menu", { exact: true })).toBeVisible();
    await page.bringToFront();
    await page.getByRole("button", { name: "Close chat" }).click();
    await page.reload();
    await expect(page.getByRole("complementary", { name: "Chat" })).toHaveCount(0);
    await page.getByRole("button", { name: /Open chat/ }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const panel = page.getByRole("complementary", { name: "Chat" });
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())!.width).toBe(390);
    await page.screenshot({ path: "/private/tmp/issue67-chat-mobile.png" });
    await info.attach("chat-mobile", { body: await page.screenshot(), contentType: "image/png" });
    await page.getByRole("button", { name: "Close chat" }).click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await peer.getByRole("button", { name: "Close chat" }).click();
    await page.getByRole("button", { name: /Open chat/ }).click();
    await page.getByRole("button", { name: /Open conversation with Chat_Opponent/ }).click();
    await page.getByRole("button", { name: "Challenge", exact: true }).click();
    await page.evaluate(async () => {
      const { server } = await (await fetch("/__transport-config")).json();
      sessionStorage.setItem(
        `dashdevil-seat:${server}`,
        btoa(String.fromCharCode(...new Uint8Array(32).fill(1))),
      );
    });
    await page.getByRole("button", { name: "Create room & invite" }).click();
    await expect(page.getByTestId("room-code")).toBeVisible();
    await expect(page.getByText("Waiting for acceptance", { exact: true })).toBeVisible();
    await peer.getByRole("button", { name: /Drag Race/ }).click();
    await peer.getByRole("button", { name: /Open chat/ }).click();
    await expect(peer.getByRole("button", { name: "Accept challenge" })).toBeEnabled();
    await expect(peer.getByTestId("room-code")).toHaveCount(0);
    await peer.getByRole("button", { name: "Accept challenge" }).click();
    await expect(peer.getByTestId("connection-state")).toHaveText("Connected");
    await page.getByRole("button", { name: "Close chat" }).click();
    await page.getByRole("button", { name: /Open chat/ }).click();
    await page.getByRole("button", { name: "Back to conversations" }).click();
    await expect(panel.getByRole("heading", { name: "Lobby opponent" })).toBeVisible();
    await info.attach("chat-desktop", { body: await page.screenshot(), contentType: "image/png" });
    await page.screenshot({ path: "/private/tmp/issue67-chat-desktop.png" });
    await page.getByRole("button", { name: "Ready", exact: true }).click();
    await peer.getByRole("button", { name: "Ready", exact: true }).click();
    await page.getByRole("button", { name: "Start round" }).click();
    await expect(page.getByTestId("countdown")).toBeVisible();
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Open chat/ })).toBeDisabled();
    await expect(page.getByTestId("countdown")).toHaveCount(0);
    await page.keyboard.press("Escape");
    const menu = page.getByRole("dialog", { name: "Race menu" });
    await expect(menu.getByRole("button")).toHaveText(["Resume", "Leave"]);
    await expect(menu.getByRole("button", { name: "Resume" })).toBeFocused();
    await expect(panel).toHaveCount(0);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    // Delivery continues while every chat surface is hidden.
    await peer.evaluate(async () => {
      const { server } = await (await fetch("/__transport-config")).json();
      const options = {
        method: "POST",
        credentials: "include" as const,
        headers: { "Content-Type": "application/json" },
      };
      const state = await (
        await fetch(`${server}/api/account/chat/sync`, {
          ...options,
          body: JSON.stringify({ activity: "Playing", client: "browser-test" }),
        })
      ).json();
      await fetch(`${server}/api/account/chat/thread/${state.acquaintances[0].id}`, {
        ...options,
        body: JSON.stringify({ text: "Delivered during gameplay", key: "gameplay-message" }),
      });
    });
    await peer.keyboard.press("Escape");
    await peer.getByRole("button", { name: "Leave", exact: true }).click();
    await peer.getByRole("button", { name: "Confirm leave", exact: true }).click();
    // Frozen final scene precedes the result boundary.
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Round Over", exact: true })).toBeVisible();
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: /Open conversation with Chat_Opponent/ }).click();
    await expect(panel.getByText("Delivered during gameplay", { exact: true })).toBeVisible();
    await panel.getByLabel("Message", { exact: true }).fill("Chat works on results");
    await panel.getByLabel("Message", { exact: true }).press("Enter");
    await expect(panel.getByText("Chat works on results", { exact: true })).toBeVisible();

    await page.evaluate(async () => {
      const { server } = await (await fetch("/__transport-config")).json();
      const options = {
        method: "POST",
        credentials: "include" as const,
        headers: { "Content-Type": "application/json" },
      };
      const state = await (
        await fetch(`${server}/api/account/chat/sync`, {
          ...options,
          body: JSON.stringify({ activity: "Active", client: "rate-test" }),
        })
      ).json();
      for (let i = 0; i < 28; i++)
        await fetch(`${server}/api/account/chat/thread/${state.acquaintances[0].id}`, {
          ...options,
          body: JSON.stringify({ text: "Rate budget", key: `budget-${i}` }),
        });
    });
    await panel.getByLabel("Message", { exact: true }).fill("Over budget");
    await panel.getByLabel("Message", { exact: true }).press("Enter");
    await expect(panel.getByRole("alert")).toContainText("Too many messages");
    await page.waitForResponse(
      (response) =>
        response.url().includes("/chat/thread/") && response.request().method() === "GET",
    );
    await expect(panel.getByRole("alert")).toContainText("Too many messages");
    await page.getByRole("button", { name: "Close chat" }).click();
    await page.getByRole("button", { name: "Return to Lobby" }).click();
    await page.getByRole("button", { name: "Leave", exact: true }).click();
    await page.getByRole("button", { name: "Confirm leave", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: /Long Drive/ }).click();
    await expect(page.getByRole("button", { name: /Open chat/ })).toBeDisabled();
    await expect(panel).toHaveCount(0);
  } finally {
    await context.close();
  }
});
