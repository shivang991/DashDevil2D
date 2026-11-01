import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { ChallengeInvitation } from "@/components/ChallengeInvitation";

test("challenge acceptance is explicit and disabled during play, other-room membership, expiry and unavailability", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let accepted = 0;
  const invitation = { id: 7, expiresAt: Date.now() + 300000, status: "Pending" as const };
  const render = async (props = {}) =>
    act(async () =>
      root.render(
        <ChallengeInvitation
          invitation={invitation}
          incoming
          playing={false}
          inRoom={false}
          onAccept={() => accepted++}
          {...props}
        />,
      ),
    );
  try {
    await render();
    expect(accepted).toBe(0);
    for (const props of [
      { playing: true },
      { inRoom: true },
      { invitation: { ...invitation, status: "Unavailable" } },
      { invitation: { ...invitation, status: "Expired" } },
      { invitation: { ...invitation, expiresAt: 0 } },
      { invitation: { ...invitation, status: "Accepted" } },
      { incoming: false },
    ]) {
      await render(props);
      expect(container.querySelector("button")?.disabled ?? true).toBe(true);
    }
    await render();
    await act(async () => {
      container.querySelector("button")!.click();
      container.querySelector("button")!.click();
    });
    expect(accepted).toBe(1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
