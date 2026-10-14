# #25 immutable configuration checkpoint

Issue: [Capture validated immutable gameplay configuration at game start](https://github.com/shivang991/DashDevil2D/issues/25). Starting revision: `5af12836ae7d6dfae25feca49d08e817589ee9c5`; branch: `codex/dashdevil-multiplayer-integration`.

Governing decisions: [configuration](https://github.com/shivang991/DashDevil2D/issues/16#issuecomment-6146866917), [preservation](https://github.com/shivang991/DashDevil2D/issues/3#issuecomment-6118779020), [verification and approved seams](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139), [stage gates](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401), [wire representations](https://github.com/shivang991/DashDevil2D/issues/14#issuecomment-6142660562). Native blocker #24 was confirmed closed before implementation.

## Requirement-to-evidence map

| Requirement | Implementation/evidence |
| --- | --- |
| Separate responsibilities and common per-mode contract | Version 1 language-neutral `packages/contracts/configuration/defaults.json`: fixed rules, gameplay by mode, presentation, room, connection and operations. Simulation depends inward on contracts. |
| Validated immutable Long Drive capture | `captureConfiguration`, `createLongDrive`, `resetLongDrive`, `GameSession` constructor/reset source. Frozen groups, detached caller inputs, inaccessible capture replacement; failed reset leaves current game/settings intact. |
| Settled defaults/units, fixed rules, explicit errors | Version 1 fixtures with literal decision-derived expectations plus numeric-only edge cases. Fixed lane count/coin value cannot be tuned; Drag Race cannot gain invincibility. Positive/zero/integer/finite ranges, spawn/speed relations, weights, geometry, reserved-heart bounds, timing, queue and traffic relations. |
| Overrides before capture, no tuning UI | Developer/test `SessionOptions.configuration` object or source callback is read at constructor/reset only. Captured settings feed simulation, renderer, resize and maximum-HP HUD. First countdown remains five seconds, restart/reset three. |
| Playable validated overrides | Simulation/session tests prove independent games, current versus next capture, atomic rejection, optional empty/heart weights, healing/consumption and disabled damage/blinking. Existing 30/60/120 FPS preservation expectations retained. |
| Resource representability | Finite boosted speed/reachable coverage, exact JavaScript projection arithmetic, microsecond timestamp range, uint32 tick/frame limits and a necessary lower bound on consumption-state size. Exact schema-sized continuation/baseline and signed projection widths await #27; current checks are explicitly insufficient for full resource acceptance. |
| Preservation and corrections | All shipped defaults retain baseline tuning/seeded coin-first generation. No geometry/track/tunneling changes: the original #26 characterization stays an expected failure. Added empty/heart pickups occur only under explicitly authorized developer overrides. |
| Required checks | Root uncached check runs TypeScript, ESLint, Go vet/test/build, shared configuration fixture scenarios, production client build and existing preservation/session/capture scenarios. Go package reports no test files: no Go semantic parity claimed before #28. Generated-output checks await #27; actual two-client transport smoke awaits #29. |
| Independent expectations and evidence | Code-review standards/spec agents review this change and decision-derived literal scenarios independently. Position parity is not claimed; tolerance remains 0.000001 world units + 10^-12 × abs(expected), with exact decisions/identities/consumption. |
| Stage gate | This is a Stage 3 configuration slice. Full Stage 3 requires #26 tracks/geometry and #27 generated contracts plus exact resource validation. New human audiovisual review remains pending; automated browser evidence alone is not full acceptance. |

## Validation and retained failures

Environment: Node 26.10.0, pnpm 8.15.9, Turbo 2.8.19; Apple M2/macOS arm64. Shared definitions and fixtures both version 1. Simulation/session random fixtures use 0.5 or 0.4 as recorded in tests; existing actual-browser scenarios use LCG seed 21 or constant 0.4/0.5. Browser viewport is 1280×900, with actual canvas/browser/hardware recorded in each run manifest.

TDD red logs, focused green logs and regular typecheck logs are retained under ignored `apps/client/test-results/config25/`. First offline dependency install lacked a Turbo tarball; normal pinned install succeeded and only the new simulation-to-contract workspace link changed the lockfile. The first typecheck rejected a TypeScript constructor parameter property under `erasableSyntaxOnly`; the compatible explicit property assignment passed later checks. Original failures remain intact.

Root `pnpm check --force`: ten tasks passed, seven Vitest files, **135 passing checks plus one retained #26 expected-failure characterization**. No cache reuse. Focused shared-configuration file: 50 checks; existing Long Drive file: 15 checks; session file: 17 checks. Go vet/test/build and production client build passed. Browser and independent-review results are recorded below when complete.

Actual Chrome: all seven preservation scenarios passed, zero retries. Run-specific provenance, screenshots/video/audio and actual environment: `apps/client/test-results/run-2026-10-14T14-41-51.534Z-Ae4tRA/manifest.json`. This captures the source/configuration diff under test. New human comparison/approval is still pending.
