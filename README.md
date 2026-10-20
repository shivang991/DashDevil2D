# DashDevil

Long Drive is playable through the React/Vite client. Multiplayer is introduced in later tickets.

Use Node **26.10.0**, pnpm **8.15.9** and Go **1.26.0**, pinned in the root manifests and version files. Native Go tooling automatically downloads the minimum toolchain when an older Go with toolchain selection is installed; CI selects the pinned version explicitly.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm --filter @dashdevil/client exec playwright install chrome ffmpeg
pnpm test:browser
```

`pnpm dev` generates the client contracts, then starts Vite directly so terminal input remains attached. Keep that terminal open while playing; Ctrl+C stops the server. `pnpm check` runs typechecking, linting, Vitest, native Go vet/tests and production builds through Turborepo. Individual root commands are `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`. Client-local commands still work from `apps/client`; install dependencies from the workspace root. Preview the production client with `pnpm --filter @dashdevil/client preview`.

Run `pnpm format` to format the client and TypeScript packages, or `pnpm format:check` to check without writing. All three workspaces share the root `.prettierrc.json`, `.prettierignore`, and Prettier dependency; generated contracts and build/test output are excluded. The same commands work inside each workspace.

| Location | Responsibility |
| --- | --- |
| `apps/client` | React, GameSession, keyboard input, rendering/audio and browser checks |
| `apps/server` | Native Go multiplayer mechanics authority, validated configuration, seeded tracks and shared fixture tests; no transport endpoints yet |
| `packages/simulation` | Headless Long Drive and shared multiplayer mechanics, time, geometry and track generation |
| `packages/contracts` | Canonical configuration, shared track/wire fixtures and generated Go/TypeScript binary contracts |

The client declares its simulation dependency and imports its exported modules by package name. Headless TypeScript typechecks without browser libraries; ESLint rejects imports of application or React code from shared packages. Go stays in its native module.

Turborepo orders local/upstream generation before checks/builds and carries upstream typecheck/build dependencies into hashes. Default source inputs include application configuration and test fixtures; global inputs also cover contract schemas/fixtures, simulation configuration, workspace/lockfiles, lint configuration and toolchain version files. Development servers are persistent and uncached. Tests and browser captures always execute so evidence is fresh. `pnpm generate` emits schema-owned Go/TypeScript types/codecs; `pnpm check:generated` detects stale output before any generation can repair it. Wire/configuration/track fixtures run in Go and TypeScript. See [protocol version 1](packages/contracts/protocol/README.md). Two-browser real-transport checks remain unavailable until #29 introduces transport.

See [Long Drive preservation](docs/preservation/README.md) and [the #24 migration checkpoint](docs/preservation/monorepo-checkpoint.md) for evidence and stage limitations. The [#27 contract checkpoint](docs/preservation/contracts-checkpoint.md) records the complete Stage 3 evidence and remaining gate limitations.

The [#28 mechanics checkpoint](docs/preservation/mechanics-checkpoint.md) records the Stage 3 owner approval, shared Go/TypeScript control timelines and implemented-mechanics scope. Multiplayer contact/object/outcome rules remain later gameplay slices; #29 must establish real transport before the combined Stage 4 gate passes.

The [#32 object/HP checkpoint](docs/preservation/objects-checkpoint.md) records default-course Drag Race obstacles, shared hearts, per-player consumption, prediction repair and elimination. Run `pnpm test:objects` for the shipped default course and `pnpm test:hearts` for the explicitly labelled reserved-heart configuration. Both use two actual Chrome contexts over real transport. Retained earlier race, room, transport and Long Drive checks remain required; later contact/correction/lifecycle tickets own the rest of the Stage 5 gate.

The [#35 lifecycle checkpoint](docs/preservation/lifecycle-checkpoint.md) records shared results, Return to Lobby, rematches over reused connections and recovery with fresh controls. Run `pnpm test:lifecycle` for the shipped default-course two-browser path plus suspension, correction-rate, forfeit/reload and replacement-guest scenarios. It is a required CI check alongside the earlier transport and Long Drive suites. Full supported-release, network, capacity and human acceptance remains separately tracked.

Deployment uses [infra/up.sh](infra/up.sh) with readiness/public HTTP3 checks and planned maintenance draining. See [deployment instructions](infra/README.md). Protocol 2 requires stale tabs to reload; `pnpm test:maintenance` is a required real-browser check.

The [#38 Road Rage checkpoint](docs/preservation/road-rage-checkpoint.md) records shared-track obstacle survival, invincibility, the authoritative HP-based deadline, remaining-time HUD and fresh rematches. Run `pnpm test:rage` for the labelled short-deadline/separated-car scenario and `pnpm test:rage-default` for shipped-default survival through elimination. Both are required real-transport CI checks; player-contact damage remains #39.
