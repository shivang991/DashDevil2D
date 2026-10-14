# DashDevil client

Run workspace installation and checks from the repository root; see [the workspace README](../../README.md).

From this directory, `pnpm dev`, `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm test` and `pnpm test:browser` operate on the client. Browser runs retain separate evidence directories under `test-results/`. Simulation comes from `@dashdevil/simulation`, a source-exporting headless workspace package.
