# Accounts and sessions

Accounts and sessions live in one SQLite database, including its WAL files. The server uses a named persistent Docker volume, or an explicit local `--database` path. Room simulations remain in memory; login survives restart, while room recovery after restart correctly fails.

Usernames are 3–24 ASCII letters, digits or underscores, stored with original capitalization and SQLite `NOCASE` uniqueness. Passwords contain 12–1024 Unicode characters, including spaces. Argon2id uses a random 16-byte salt, 64 MiB, three passes and four threads. Only password hashes and SHA-256 session-token digests are stored. Sessions use 256-bit random bearer tokens and expire after 30 days without sliding renewal.

The `__Host-dashdevil-session` cookie is Secure, HttpOnly, SameSite=Strict, Path=/, with no Domain. The configured website origin must match every mutation, including binary room admission. Account mutations also require JSON; credentialed CORS permits only that exact origin. Login failures use a generic error. Login attempts are bounded per case-insensitive username (10/15 minutes) and TCP peer (100/15 minutes), with two concurrent password computations and bounded limiter storage. Successful login clears that username's failure budget. Behind nginx, the TCP peer budget is shared; forwarded headers are deliberately not trusted. Counters reset on process restart; accounts and sessions do not.

## Operator setup

No public registration or account-management HTTP endpoint exists. Bootstrap the single admin once, supplying the password on stdin from a protected file or password manager. Do not put it in command arguments, client configuration or logs. From the repository root:

```sh
cd apps/server
go run ./cmd/setup --database ../../.local/transport/accounts.sqlite --username Site_Admin < /secure/admin-password
```

This database path matches `pnpm dev:transport`. Direct server launches accept `--database`; their default is `.local/accounts.sqlite` relative to the process working directory. `pnpm dev` alone retains guest Long Drive; use the HTTPS transport harness for local login/multiplayer. Add `--temporary-password` to setup to require replacement of the admin's initial password on first login. Setup rejects duplicate usernames and any second admin, even under a different name.

On Docker, after starting the deployment:

```sh
docker compose --env-file infra/.env -f infra/compose.yml exec -T server \
  dashdevil-setup --database /var/lib/dashdevil/accounts.sqlite \
  --username Site_Admin < /secure/admin-password
```

The `accounts` volume retains the database across server/container replacement. Preserve that volume during deployments and back up the database consistently with its WAL (or stop the server before copying the volume). Nginx forwards `/api/account`, including cookies and JSON requests, to the private TLS server. The private readiness/drain listener has no account-administration routes.

## HTTP and multiplayer boundaries

- `POST /api/account/login`: `{username,password}`; sets an independent persistent session.
- `GET /api/account`: current account, expiry and `mustChangePassword`; no bearer token or password data.
- `POST /api/account/password`: `{password}`; only temporary-password sessions may use this first-login flow. Atomically replaces the password, revokes existing account sessions and returns a new normal session.
- `POST /api/account/logout`: revokes only the current session and removes its multiplayer access.

Temporary accounts can retrieve their login state, replace their password or log out; multiplayer is denied until replacement. `Store.CreateTemporary` is a server-side seam for later operator administration, not public registration. Normal profile/password editing and account-management UI remain later tickets.

Every product seat records its owning account/session. Names come from the account; client names are ignored. Admission/recovery requires a live non-temporary session, and recovery must match the original session. One-use room/gameplay tickets also validate that session when consumed. Expiry revokes active seats at the session deadline. `Server.RevokeSession` and `Server.RevokeAccountSessions` combine durable revocation with removal of all corresponding reconnect credentials, tickets and seats, using existing forfeit/abandonment rules. Future reset/deletion handlers must use these server seams, rather than only deleting a database session or closing a socket. A separate authentication mutex orders admission, ticket consumption and revocation; SQLite I/O never holds gameplay ownership, so a blocked database writer cannot stall unrelated rooms. Ticket consumption revalidates its in-memory ownership and expiry after the database lookup. Multiple devices, sessions and independent seats per account are allowed.

Logout clears tab reconnect state. Other tabs sharing the same cookie refresh through a BroadcastChannel; rejected sessions also refresh after transport failure, on window focus and periodically. Independent browser/device sessions remain valid. The explicit `--diagnostic` mode retains its stationary transport fixture, without product gameplay or account administration.

## Verification

`go test ./transport -run 'TestAccount|TestGuests|TestCredentialRules|TestTemporaryPassword|TestLogout|TestSessionExpiry|TestSessionRevocation'` exercises real HTTPS, SQLite reopen, rules, first-login replacement, session expiry, cross-site rejection, throttling, identity binding and seat/ticket revocation. `pnpm test:accounts` bootstraps a temporary admin through the actual setup command, replaces its password in Chrome, reloads its durable login, plays Drag Race with an independent session, and verifies cross-tab logout/forfeit while the other session remains usable. `accounts-guest.spec.ts` covers guest gating, login Back and playable Long Drive. Existing multiplayer browser suites now obtain real independent logins through the same UI.
