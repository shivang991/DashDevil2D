# #24 monorepo migration checkpoint

Issue: [Move playable Long Drive into the target monorepo](https://github.com/shivang991/DashDevil2D/issues/24). Implementation comparison: `ad0f70ba7993048d39bc3bb0d9e9ca4cc1f4b377` (accepted Stage 2).

Governing decisions: [module ownership](https://github.com/shivang991/DashDevil2D/issues/15#issuecomment-6144509055), [verification and approved seams](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139), [stage gates](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401), [Go runtime](https://github.com/shivang991/DashDevil2D/issues/18#issuecomment-6147409056).

## Requirement-to-evidence map

| Requirement | Implementation / evidence |
| --- | --- |
| Settled boundaries and inward dependencies | `apps/client`, `apps/server`, `packages/simulation`, `packages/contracts`; client declares `workspace:*` simulation dependency with explicit source exports; headless ES2022-only typecheck and ESLint application/React import restrictions. A stdin lint probe rejected both React and client imports. |
| Go remains native, only prerequisite server scaffolding | Go 1.26.0 native module with package declaration only; Go vet/test/build now mandatory. `go test` reports no test files; no gameplay coverage is claimed. |
| Root pnpm/Turborepo orchestration | Frozen workspace install; typecheck, lint, build and uncached tests/browser tasks. Dry task graph records local/upstream generation dependencies. There is no implemented generation command until #27. |
| Correct cache inputs and persistent development | Workspace lockfile, configuration, schemas/fixtures and pinned toolchain files contribute to hashes; probes changing toolchain/configuration/contract fixture inputs each invalidate client build and restore original hashes. Development is persistent/uncached; tests and browser evidence are uncached. |
| Playable Long Drive preservation | Existing approved simulation/session/keyboard and capture seams; source comparison found all 28 source/asset files identical after rewriting simulation imports. All 725 previous package resolution blocks are unchanged (seven new Turbo/platform entries). No gameplay corrections in #24. |
| Independent expectations and precision | Reuse the independently reviewed Stage 1/2 expectations and fixtures (scenario version 2); only module/capture paths change. Literal exact decisions/consumption remain intact; no Go/TS continuous-position parity claim. The retained #26 swept-collision characterization remains an expected failure. |
| Browser/presentation/audio and provenance | Run-specific manifests retain actual source/diff/configuration/fixture hashes, seed, browser/OS/hardware/canvas and screenshots/video/audio. Existing Stage 2 audiovisual owner signoff remains historical; new captured media does not itself constitute human signoff. |
| Required unavailable checks | Shared compatibility fixtures and generated-output checks await #27; Go mechanics/parity await #28; two-browser real WebTransport smoke awaits #29. Reserved contracts directory and Go package declaration do not make these checks available. |
| Stage gate | #24 is one Stage 3 slice. #25–#27 still own validated immutable configuration, discrete tracks/resize-independent geometry and generated contracts. Do not enter Stage 4 based on this migration. |

## Validation and evidence

Local environment: Apple M2, macOS arm64; Node 26.10.0, pnpm 8.15.9, Turbo 2.8.19, Go 1.26.0. Root frozen install, typecheck, lint, focused Long Drive (15 checks), capture provenance (2 checks) and production client/native Go build passed. **Root `pnpm check`: 10 tasks successful; six Vitest files, 84 passing checks and one retained #26 expected-failure characterization. Actual Chrome: all seven scenarios pass, zero retries, including canvas/HUD, resize/game-over, audio/mute, focus/countdown and restart/menu lifecycle.**

Local tooling/log/hash probes are retained under ignored `apps/client/test-results/migration24-2026-10-14/`; browser invocations get separate `run-...` folders and CI uploads the entire results tree. The first pre-install focused invocation could not find Vitest, and Corepack's registry lookup failed under network restriction; dependency installation and direct pinned pnpm resolved these prerequisites. No product-test failure was hidden or reclassified. Earlier Stage 1/2 failed evidence is retained.

No new test seam or mirrored implementation tests were introduced; the approved behavioral seams and independently reviewed scenarios are reused. This checkpoint establishes only the applicable migration checks, not the supported-release matrix, performance/capacity thresholds, multiplayer playtests or full acceptance.

Browser evidence: `apps/client/test-results/run-2026-10-14T14-11-49.782Z-nIbbX1/manifest.json` (tested starting revision plus complete staged migration diff/configuration snapshots, result `passed`). These videos/screenshots/audio are retained locally and CI repeats the same scenario suite. Root `pnpm dev` reached Vite ready on port 5174 (5173 already occupied) and was stopped after the startup check.

Independent [standards/spec and reused-expectations review](monorepo-review.md) of implementation `474e5ea`: zero findings in each axis. Actual Chrome version **155.0.8059.79**, baseline viewport **1280×900**, canvas **606×806**, LCG seed **21** (isolated coin scenario uses constant **0.4**). New human audiovisual review remains pending; historical Stage 2 owner signoff is retained separately.
