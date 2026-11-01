# Issue 60 implementation review

Spec: [Player profile: username, avatar, and password changes](https://github.com/shivang991/DashDevil2D/issues/60).
Baseline: `6093f0853561bdda0599e2b995bc0352fe6513c1` on `feat/auth`.
Two independent review agents examined standards and spec compliance, then rechecked the fixes.

## Standards

- **Resolved P2: live-avatar retention on store open.** Generic `accounts.Open` originally removed orphan images, including snapshots still used by a running server when an operator opened the same database. Cleanup now belongs to the room-owner server lifecycle. Opening a store preserves images.
- **Resolved naming judgment:** `changeTemporaryPassword` also handled normal password changes. Renamed `changePassword`.

Initial: one documented behavior breach, one naming judgment. Worst: premature snapshot deletion. Outstanding: **0** after re-review.

## Spec

- **Resolved P2: participant departure removed result identity.** Round results originally read live seats. Immutable round identities now travel separately in `RoomState.racers`; avatar cleanup retains them until remaining viewers return to the lobby or the room disappears. Integration coverage finishes a tie, removes one participant, verifies the remaining result's original name/avatar, then verifies cleanup after returning.
- **Resolved P2: unnecessary 2048-pixel side restriction.** Ordinary 3000 × 1000 uploads now work. Decoding uses a 16-megapixel resource budget; validated JPEG/PNG/WebP sources up to 2 MiB normalize to PNG at most 512 pixels per side. Tests cover the ordinary wide image, exact upload limit, decoded dimensions, invalid/truncated content, replacement and removal.

Initial: two findings. Worst: result snapshot lifetime. Outstanding: **0** after re-review and the departure regression passing.

## Verification

- Full workspace typecheck, lint, tests and builds; 550 client tests plus all Go packages.
- Profile HTTP/WebSocket integration: authorization, atomic updates, case-insensitive concurrent rename conflict, renamed login, restart persistence, uploads and cleanup, frozen active/result identities, current-session preservation and other-session gameplay/reconnect revocation.
- Chrome account/profile scenarios: Save/discard, Escape/focus return, validation and server errors retaining edits, avatar save/remove, password verification, independent-device logout and renamed login. Saved-profile screenshot visually inspected.
- Secure transport: 3/3 Chrome scenarios passed. Rooms: 5/5 passed. Targeted Go race detection passed with no race reports; an earlier instrumented run hit the fixture's four-second TLS setup deadline under concurrent load, then passed in isolation.
- Broad browser preservation: 17/19 passed. Two pre-existing failures remain: `race-layout.spec.ts` references `race-layout.html`, absent already at the baseline; unchanged `multiplayer.spec.ts` expects shift progress 160 while the unchanged simulation returns 200. The diagnostic HTML, mechanics test and simulation sources are unchanged from the baseline. These failures are outside the profile work.

Protocol 4 requires client/server deployment together. SQLite remains the durable store for credentials, sessions, profiles and validated avatar images. No email, signup, race-history, chat or role-management scope added.
