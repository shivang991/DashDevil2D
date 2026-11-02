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

### Storybook

From the repository root:

```sh
pnpm storybook        # http://localhost:6006
pnpm build:storybook  # apps/client/storybook-static
pnpm test:storybook   # build, then check every story and its play function in Chrome
```

Storybook lives in `apps/client/.storybook` because the client owns the UI. It runs
independently, with its own Vite config, and shares the game's CSS, fonts, aliases,
and public textures. No multiplayer server or HTTPS setup is needed. The static
output can be hosted separately. A shared UI package can follow if another app
actually consumes these components; `packages/*` currently stays headless.

Stories live alongside components as `*.stories.tsx`. Controls and Actions expose
props and callback calls. Interaction assertions cover menu navigation, login and
password changes, profile editing, admin confirmations, avatar uploads, chat,
challenges, join codes, and leave confirmations. Typechecking includes stories and config.

The catalog covers guest/authenticated/admin menus, login and temporary passwords,
profile and admin dialogs, avatars and uploads, chat conversations, expiring room
challenges, reusable buttons, actual game menu buttons, menu navigation,
Long Drive HUD/countdown/pause/game-over, round outcomes, and multiplayer
entry/loading/error/lobby/countdown/reconnection/result/leave states.
`GameWorldView` and `MultiplayerView` are the same presentation components used
by the live screens. Stories supply fixed state and mock actions: the game canvas
is intentionally idle in Long Drive. Multiplayer playing stories use the real
race renderer with frozen cars, objects, and HUD data; controls log calls without
advancing gameplay. Sound toggles are isolated from saved game preferences.
Account and chat transport modules are fully mocked through Storybook
[automocking](https://storybook.js.org/docs/writing-stories/mocking-data-and-modules/mocking-modules).
`src/stories/mockTransport.ts` restores fixture responses before each story;
story-level hooks provide errors, loading, and other states. Mutations remain mock
calls and do not persist. Chat preferences use a dedicated fixture account and
restore its previous local storage value after each story.

`pnpm test:storybook` requires Playwright Chrome (`pnpm --filter @dashdevil/client
exec playwright install chrome`). It serves the static build on port 6007, runs
every catalog story and its interaction assertions, and fails on render errors,
browser exceptions, or unexpected account-server requests. CI runs it on pull
requests and preserves failure screenshots/traces in `test-results/storybook`.
Use the existing game/browser tests for actual gameplay and transport.
Visual-regression CI is not configured.

Configuration follows the [React/Vite integration](https://storybook.js.org/docs/get-started/frameworks/react-vite)
and [dedicated Vite config](https://storybook.js.org/docs/builders/vite) guidance.
