import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { RaceHistoryDialog } from "@/screens/RaceHistoryDialog";
import { accountAPI } from "@/transport/account";

test("history loads on open, paginates, retries, and resets on reopen", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const history = vi
    .spyOn(accountAPI, "history")
    .mockResolvedValueOnce({
      races: [
        {
          id: "race",
          seat: 0,
          mode: "drag-race",
          startedAt: "2026-11-01T12:00:00Z",
          result: "win",
          opponent: "Rival",
        },
      ],
      hasNext: true,
    })
    .mockRejectedValueOnce(new Error("Unavailable"))
    .mockResolvedValue({ races: [], hasNext: false });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const click = async (label: string) => {
    const button = [...document.querySelectorAll("button")].find(
      (element) => element.textContent === label,
    );
    expect(button).toBeTruthy();
    await act(async () => button!.click());
  };
  try {
    await act(async () => root.render(<RaceHistoryDialog authenticated />));
    expect(history).not.toHaveBeenCalled();
    await click("Race History");
    expect(document.body.textContent).toContain("vs Rival");
    expect(document.body.textContent).toContain("Win");
    await click("Next");
    expect(history).toHaveBeenLastCalledWith(1);
    expect(document.body.textContent).toContain("Unavailable");
    await click("Retry");
    expect(document.body.textContent).toContain("No more races.");
    await click("Close");
    await click("Race History");
    expect(history).toHaveBeenLastCalledWith(0);
    expect(document.body.textContent).toContain("No completed races yet.");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  }
});

test("guests get sign-in prompt without history requests", async () => {
  const history = vi.spyOn(accountAPI, "history");
  const onLogin = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(<RaceHistoryDialog authenticated={false} onLogin={onLogin} />),
    );
    await act(async () => host.querySelector("button")!.click());
    expect(document.body.textContent).toContain("Sign in to view your race history.");
    const signIn = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Sign in",
    )!;
    await act(async () => signIn.click());
    expect(onLogin).toHaveBeenCalledOnce();
    expect(history).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  }
});
