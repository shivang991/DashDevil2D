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

`pnpm dev` starts Vite. `pnpm check` runs typechecking, linting, Vitest, native Go vet/tests and production builds through Turborepo. Individual root commands are `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`. Client-local commands still work from `apps/client`; install dependencies from the workspace root. Preview the production client with `pnpm --filter @dashdevil/client preview`.

| Location | Responsibility |
| --- | --- |
| `apps/client` | React, GameSession, keyboard input, rendering/audio and browser checks |
| `apps/server` | Native Go module scaffold; no endpoints, authority or transport yet |
| `packages/simulation` | Headless TypeScript Long Drive mechanics and geometry, exported as workspace source |
| `packages/contracts` | Reserved canonical schemas/configuration/fixture ownership for #25/#27 |

The client declares its simulation dependency and imports its exported modules by package name. Headless TypeScript typechecks without browser libraries; ESLint rejects imports of application or React code from shared packages. Go stays in its native module.

Turborepo orders local/upstream generation before checks/builds and carries upstream typecheck/build dependencies into hashes. Default source inputs include application configuration and test fixtures; global inputs also cover contract schemas/fixtures, simulation configuration, workspace/lockfiles, lint configuration and toolchain version files. Development servers are persistent and uncached. Tests and browser captures always execute so evidence is fresh. There is no generator yet: #27 must add its real `generate` and generated-output verification scripts, and shared compatibility checks become mandatory when those fixtures exist. Two-browser real-transport checks remain unavailable until #29 introduces transport.

See [Long Drive preservation](docs/preservation/README.md) and [the #24 migration checkpoint](docs/preservation/monorepo-checkpoint.md) for evidence and stage limitations. Stage 3 also requires #25–#27; this workspace move alone does not pass that gate.
