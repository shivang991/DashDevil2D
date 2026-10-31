# Accounts and sessions

Accounts and sessions live in one SQLite database, including its WAL files. The server uses a named persistent Docker volume, or an explicit local `--database` path. Room simulations remain in memory; login survives restart, while room recovery after restart correctly fails.

Usernames are 3–24 ASCII letters, digits or underscores, stored with original capitalization and SQLite `NOCASE` uniqueness. Passwords contain 12–1024 Unicode characters, including spaces. Argon2id uses a random 16-byte salt, 64 MiB, three passes and four threads. Only password hashes and SHA-256 session-token digests are stored. Sessions use 256-bit random bearer tokens and expire after 30 days without sliding renewal.

The `__Host-dashdevil-session` cookie is Secure, HttpOnly, SameSite=Strict, Path=/, with no Domain. The configured website origin must match every mutation, including binary room admission. Account mutations also require JSON; credentialed CORS permits only that exact origin. Login failures use a generic error. Login attempts are bounded per case-insensitive username (10/15 minutes) and TCP peer (100/15 minutes), with two concurrent password computations and bounded limiter storage. Successful login clears that username's failure budget. Behind nginx, the TCP peer budget is shared; forwarded headers are deliberately not trusted. Counters reset on process restart; accounts and sessions do not.

## Operator setup

No public registration exists. Set credentials in `infra/.env` before deploying:

```dotenv
ADMIN_USERNAME=Site_Admin
ADMIN_PASSWORD='your-strong-password'
```

Compose passes these to the server. First startup creates the single admin in the mounted database; subsequent starts preserve existing credentials, including password changes made in the app. Changing these variables does not reset an existing admin. Username: 3–24 ASCII letters, digits or underscores. Password: 12–1024 characters. Keep `infra/.env` private and untracked.

For Docker secrets, leave `ADMIN_PASSWORD` empty, mount a Compose secret on the server and set `ADMIN_PASSWORD_FILE=/run/secrets/admin_password`. The path is inside the container; setting the variable alone does not mount the file. Never set both password sources.

Local development accepts the same environment variables with `pnpm dev:transport`, using `.local/transport/accounts.sqlite`. Direct server launches use their `--database` path. `pnpm dev` alone retains guest Long Drive. Set `ADMIN_TEMPORARY_PASSWORD=true` to require first-login replacement. With no credentials configured, startup preserves the existing behavior without creating an admin.

The `accounts` volume retains the database across server/container replacement. Preserve that volume during deployments and back up the database consistently with its WAL (or stop the server before copying the volume). Nginx forwards `/api/account`, including cookies and JSON requests, to the private TLS server. The private readiness/drain listener has no account-administration routes.

## HTTP and multiplayer boundaries

- `POST /api/account/login`: `{username,password}`; sets an independent persistent session.
- `GET /api/account`: current account, expiry and `mustChangePassword`; no bearer token or password data.
- `POST /api/account/password`: `{password}`; only temporary-password sessions may use this first-login flow. Atomically replaces the password, revokes existing account sessions and returns a new normal session.
- `POST /api/account/logout`: revokes only the current session and removes its multiplayer access.

Temporary accounts can retrieve their login state, replace their password or log out; multiplayer is denied until replacement. `Store.CreateTemporary` creates a first-login credential, not public registration. Normal profile/password editing is described below.

Every product seat records its owning account/session. Names come from the account; client names are ignored. Admission/recovery requires a live non-temporary session, and recovery must match the original session. One-use room/gameplay tickets also validate that session when consumed. Expiry revokes active seats at the session deadline. `Server.RevokeSession` and `Server.RevokeAccountSessions` combine durable revocation with removal of all corresponding reconnect credentials, tickets and seats, using existing forfeit/abandonment rules. Admin reset/deletion holds the same authentication lock, atomically changes durable credentials and revokes account seats through the shared lifecycle path. A separate authentication mutex orders admission, ticket consumption and revocation; SQLite I/O never holds gameplay ownership, so a blocked database writer cannot stall unrelated rooms. Ticket consumption revalidates its in-memory ownership and expiry after the database lookup. Multiple devices, sessions and independent seats per account are allowed.

Logout clears tab reconnect state. Other tabs sharing the same cookie refresh through a BroadcastChannel; rejected sessions also refresh after transport failure, on window focus and periodically. Independent browser/device sessions remain valid. The explicit `--diagnostic` mode retains its stationary transport fixture, without product gameplay or account administration.

## Verification

`go test ./transport -run 'TestAccount|TestGuests|TestCredentialRules|TestTemporaryPassword|TestLogout|TestSessionExpiry|TestSessionRevocation'` exercises real HTTPS, SQLite reopen, rules, first-login replacement, session expiry, cross-site rejection, throttling, identity binding and seat/ticket revocation. `pnpm test:accounts` bootstraps a temporary admin through server startup environment, replaces its password in Chrome, reloads its durable login, plays Drag Race with an independent session, and verifies cross-tab logout/forfeit while the other session remains usable. `accounts-guest.spec.ts` covers guest gating, login Back and playable Long Drive. Existing multiplayer browser suites now obtain real independent logins through the same UI.

## Player profiles

Normal sessions can `POST /api/account/profile` with `{username, avatar?}`. Omit `avatar` to retain it, send an empty string to remove, or send base64 file bytes to replace. Username and avatar save atomically; username conflicts return 409. Existing sessions retain their identity binding and immediately read the saved username, including for login.

Uploads accept decoded JPEG, PNG and WebP, at most 2 MiB and 16 megapixels. The server downsizes to at most 512 pixels per side and re-encodes pixels as PNG, discarding metadata and trailing content. Immutable random avatar IDs reference BLOBs in the existing private SQLite database; the same persistent volume/backups cover profiles. `GET /api/account/avatars/:id` serves only stored PNG with nosniff and restrictive CSP. Old images are deleted after current profiles and live room snapshots release them; startup removes orphaned snapshots because rooms do not survive a restart. Run one room-owner server per database, as with existing multiplayer ownership.

`POST /api/account/password` also accepts `{currentPassword,password}` for normal sessions. It checks the current credential and existing password rules, atomically updates the hash, retains the caller's session, and removes all other sessions, seats, tickets and reconnect credentials. The temporary-password flow remains unchanged.

The menu profile supports explicit Save, discard on close, avatar preview/replace/remove and current-password changes. Active rounds retain their starting username/avatar through their result; returning to the lobby and starting new rounds refresh saved account identity. Protocol 4 adds immutable avatar IDs to room seats; deploy client and server together. Proxy/server accept 3 MiB JSON bodies to accommodate a base64-encoded 2 MiB upload; binary admission still enforces its own frame limit.

`go test ./transport -run TestProfile` covers authorized updates, concurrent case-insensitive conflicts, rename login, persistence/restart, upload decoding/size/cleanup, frozen race identities and cross-device session/gameplay revocation. `pnpm test:accounts` covers Save/discard, focus return, retained validation/server errors, avatar upload/remove, password verification, other-device logout and renamed login in Chrome.

## Admin users panel

Only the configured admin with a normal session can reach the users panel. Every `/api/account/admin` endpoint independently requires that authorization through shared middleware; writes additionally require the configured Origin and JSON. The private readiness/drain listener stays separate.

- `GET /api/account/admin/users`: `{users}` with username, avatar, creation and last-observed authenticated activity timestamps. Migrated accounts have unknown creation times; an unobserved last-seen time is null. Activity is observed at successful login, authenticated HTTP requests and ticket consumption, not exact live presence.
- `POST /api/account/admin/users`: `{username}` creates a non-admin with a cryptographically generated temporary password.
- `POST /api/account/admin/users/:id/profile`: `{username,avatar?}` uses the same validation, atomic save, lobby refresh and frozen race/result snapshots as player edits, including for accounts still using temporary passwords.
- `POST /api/account/admin/users/:id/reset`: generates a temporary password and atomically revokes all sessions before removing seats, tickets and reconnect access. A fresh password change is required.
- `POST /api/account/admin/users/:id/delete`: requires `{confirm:true}` and permanently deletes a non-admin account and its sessions/profile. SQL and HTTP both protect the configured admin. Existing explicit-departure forfeit/abandonment semantics apply. Unreferenced avatars are removed; immutable avatars still referenced by active/result snapshots retain the existing snapshot lifetime.

Create/reset return `temporaryPassword` only in that successful response. Only its Argon2id hash is persisted. The panel keeps the response in memory for copying and manual sharing, with dismissal; reload/navigation cannot reveal it. There is no password retrieval, email, role editing, history or real chat.

`node apps/client/scripts/transport.mjs --test --admin` exercises the admin UI in Chrome against real HTTPS/SQLite. `go test ./transport -run 'TestAdmin|TestEveryAdmin'` covers authorization, first login, profiles, metadata/restart, concurrent sessions/rooms, active forfeits, cleanup and rejected stale/authenticated recovery.
