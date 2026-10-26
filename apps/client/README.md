# DashDevil client

Run workspace installation and checks from the repository root; see [the workspace README](../../README.md).

From this directory, `pnpm dev`, `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm test` and `pnpm test:browser` operate on the client. Browser runs retain separate evidence directories under `test-results/`. Simulation comes from `@dashdevil/simulation`, a source-exporting headless workspace package.

For multiplayer entry, lobby and countdown, run `pnpm dev:transport` from the root and open the printed HTTPS application URL in two browsers. Trusted development HTTPS requires the documented mkcert setup. Long Drive also remains available through `pnpm dev`. `pnpm test:rooms` runs the mandatory secure two-browser room checks; `pnpm test:transport` retains the separate stationary transport diagnostic.

Format client files with `pnpm format`, or check formatting without changes with `pnpm format:check`.
From the repository root, use `pnpm format` or `pnpm format:check` through Turborepo
to cover the client and TypeScript packages. All use the shared root Prettier config and ignore file.
Prettier uses two spaces, semicolons, double quotes,
trailing commas, and a 100-column line width. Build output and test reports are excluded.

### Multiplayer diagnostics

Set `VITE_MULTIPLAYER_DEBUG=true` in `apps/client/.env.local` (restart Vite) to show connection and round diagnostics. Hidden by default; transport acceptance tests enable them automatically.
