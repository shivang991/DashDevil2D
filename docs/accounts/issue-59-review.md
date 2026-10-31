# Issue #59 verification and review

Issue: [Accounts, login, and authenticated multiplayer](https://github.com/shivang991/DashDevil2D/issues/59).
User-approved review baseline: `19c5014d43c8a40e9d339143ea55387d57012be2`.
Implementation commit: `2e15eb7` plus the follow-up concurrency fix. Test seams approved: account HTTP API, multiplayer transport, browser UI.

## Standards

Initial independent review identified:

- **[P1] SQLite I/O holds global gameplay mutex.** New `Accounts.Revoke`, `Authenticate` and `Session` calls ran while `s.mu` was held, violating the documented owner rule “never hold across I/O”. A SQLite writer can wait five seconds and stall unrelated room input, ticks and heartbeats. **Fixed:** durable authentication uses a separate mutex; SQLite I/O runs outside gameplay ownership. Admission/revocation remain ordered; ticket consumption rechecks existence, owner, generation and expiry after its lookup.
- **Possible Duplicated Code — judgement call.** Logout duplicated `RevokeSession` rather than using the shared revocation seam. **Fixed:** logout calls that seam.

Follow-up independent review: both findings resolved; no lock-order inversion or remaining material standards finding. No widget-transition violations found.

## Spec

Independent review found no confirmed missing/partial requirements, scope creep, or incorrectly implemented behavior. Follow-up review of the concurrency fix found no new security/correctness issue: authentication ordering and atomic ticket deletion remain intact.

Counts: Standards 2 findings resolved, 0 outstanding; Spec 0 findings.

## Verification

- Full workspace checks: `pnpm check --env-mode=loose` (local cache environment workaround). Typechecking, lint, 546 client tests, native Go tests and production builds pass.
- Account transport integration tests cover durable database reopen/login, one-admin setup, username/password rules, forced replacement and session rotation, 30-day expiry, CSRF/content-type rejection, login throttling, forged names, cross-session recovery denial, all-seat/ticket logout revocation, active room cleanup and independent sessions.
- Writer-lock regression: real external SQLite writer plus live HTTPS/room transport. Confirmed failure against the initial implementation; passes after moving database I/O outside gameplay ownership. Go race-detector coverage passes.
- `pnpm test:accounts`: real setup command, temporary-admin first login, password confirmation errors, password replacement, authenticated reload, two Chrome contexts playing Drag Race, profile close, cross-tab logout and canonical forfeit while the independent session stays usable.
- `pnpm test:rooms`: all 5 retained browser scenarios pass with account login, including playable Road Rage, leading-zero codes, denied local storage, reload recovery and readiness acknowledgement.
- Standard browser suite: 17 pass; two pre-existing fixture failures. Both reproduce against isolated baseline `19c5014`: `multiplayer.spec.ts` expects progress 160 while its unchanged simulation fixture produces 200; `race-layout.spec.ts` navigates to a missing `race-layout.html` fixture. Guest gating/login Back/Long Drive and all Long Drive baseline scenarios pass.
- Docker Compose validates. Server and setup binaries cross-build for Linux amd64 with `CGO_ENABLED=0`, matching the container build. Production deployment itself was not changed or restarted.

Local browser evidence stays under ignored `apps/client/test-results/`. Operator setup, persistence, HTTP endpoints and future revocation seams: [account documentation](../../apps/server/accounts/README.md).
