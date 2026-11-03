import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ProfileDialog } from "@/screens/ProfileDialog";
import { AdminScreen } from "@/screens/AdminScreen";
import { accountAPI, adminAPI } from "@/transport/account";

const account = {
  id: 1,
  username: "Driver",
  admin: false,
  mustChangePassword: false,
  expires: "2026-12-01",
  avatar: "old",
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
for (const mode of ["profile", "admin"] as const) {
  test(`${mode} editor validates uploads, disables pending saves, previews, removes, and invalidates closed reads`, async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const readers: { result: string; onload?: () => void; onerror?: () => void }[] = [];
    vi.stubGlobal(
      "FileReader",
      class {
        result = "data:image/png;base64,bmV3";
        onload?: () => void;
        onerror?: () => void;
        constructor() {
          readers.push(this);
        }
        readAsDataURL() {}
      },
    );
    vi.spyOn(adminAPI, "users").mockResolvedValue({
      users: [{ ...account, createdAt: "2026-01-01", lastSeenAt: null }],
    });
    const saveProfile = vi.spyOn(accountAPI, "updateProfile").mockResolvedValue(account);
    const saveAdmin = vi.spyOn(adminAPI, "update").mockResolvedValue(account);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const button = (text: string) =>
      Array.from(document.querySelectorAll("button")).find((b) => b.textContent === text)!;
    const click = async (text: string) => {
      await act(async () => button(text).click());
    };
    const file = async (value: File) => {
      const input = document.querySelector('input[type="file"]')!;
      Object.defineProperty(input, "files", { configurable: true, value: [value] });
      await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    };
    const complete = async (index: number) => {
      await act(async () => readers[index].onload?.());
    };
    try {
      await act(async () =>
        root.render(
          mode === "profile" ? (
            <ProfileDialog account={account} />
          ) : (
            <AdminScreen onBack={vi.fn()} onAccountSaved={vi.fn()} />
          ),
        ),
      );
      await click(mode === "profile" ? "Profile" : "Edit");
      for (const invalid of [
        new File([], "empty.png", { type: "image/png" }),
        new File(["x"], "bad.txt", { type: "text/plain" }),
        new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
      ]) {
        await file(invalid);
        expect(document.querySelector('[role="alert"]')?.textContent).toContain("up to 2 MB");
      }
      expect(readers).toHaveLength(0);
      await file(new File(["x"], "new.png", { type: "image/png" }));
      expect(button("Save").disabled).toBe(true);
      await complete(0);
      expect(document.querySelector('img[src="data:image/png;base64,bmV3"]')).not.toBeNull();
      expect(button("Save").disabled).toBe(false);
      await click("Save");
      expect(mode === "profile" ? saveProfile : saveAdmin).toHaveBeenCalledWith(
        ...(mode === "profile" ? ["Driver", "bmV3"] : [1, "Driver", "bmV3"]),
      );
      if (mode === "admin") await click("Edit");
      await file(new File(["x"], "new.webp", { type: "image/webp" }));
      await click("Remove avatar");
      await complete(1);
      expect(document.querySelector('img[src^="data:"]')).toBeNull();
      expect(button("Save").disabled).toBe(false);
      await click("Save");
      expect(mode === "profile" ? saveProfile : saveAdmin).toHaveBeenLastCalledWith(
        ...(mode === "profile" ? ["Driver", ""] : [1, "Driver", ""]),
      );
      if (mode === "admin") await click("Edit");
      await file(new File(["x"], "new.jpg", { type: "image/jpeg" }));
      await click(mode === "profile" ? "Close" : "Cancel edit");
      await complete(2);
      await click(mode === "profile" ? "Profile" : "Edit");
      expect(document.querySelector('img[src^="data:"]')).toBeNull();
      if (mode === "profile") expect(button("Change password")).toBeDefined();
      else expect(button("Save").disabled).toBe(false);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
}
