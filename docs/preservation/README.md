# Long Drive preservation

**Stage 1 accepted on 2026-10-14.** The project owner reported “review pass” in Codex after receiving the baseline review files. This records the owner’s audiovisual signoff and unblocks #22; no additional browser, hardware or observation details were supplied. Product gameplay and assets remain unchanged at this checkpoint.

## Authority and provenance

Baseline: `a68f27efd1d79ec8eea7ef0b0a6d8567606189dd`; original integration start: `23979fb648636a46e763240bafb3c1965749758c`. The original product source/public assets were compared against that baseline and matched.

Governing resolutions: [preservation](https://github.com/shivang991/DashDevil2D/issues/3#issuecomment-6118779020), [verification and approved seams](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139), [stage gates](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401), and [world geometry](https://github.com/shivang991/DashDevil2D/issues/5#issuecomment-6119616392).

Independent expectation reviewer `/root/baseline_expectations`, 2026-10-14, read these contracts and pinned original sources before reviewing tests. Expectations come from the contracts, rather than generated implementation results: HP 2, score 0, middle lane, empty road, 5-second first/3-second reset countdowns, coins worth 10, 2-second protection, 0.15-second held steering, 10× acceleration/80-unit upward target, 400 base speed (+15 per active second, capped 900), spawn interval 1.0 falling by 0.03 to 0.35, 0.45 coin probability, strict unrotated car/coin/obstacle bounds 50×80/28×28/48×40. Score/HP/targets/consumption/lifecycle decisions are exact; timer milestones allow 50 ms active time. Future Go/TS continuous positions permit only `0.000001 + 1e-12 * abs(expected)` world-unit error; events, identities, canonical times and wire bytes remain exact.

The [original artifact manifest](evidence/manifest.json), [environment](evidence/browser-environment.json), [audio scope](evidence/audio-capture.json), [controlled visibility measurement](evidence/audio-hidden-platform-fixture.json), [resize dimensions](evidence/resize-environment.json), and [failure/retry summary](evidence/failure-summary.json) retain provenance. Original actual Chrome canvas: **606×806 at 1280×900**, extra viewport 800×600. Hardware is Apple M2/8 GB macOS; comparable reference-machine qualification and native tab suspension are not claimed. The original archive was deliberately pruned at the user's request: logs, diagnostic traces, generated error-context Markdown and redundant videos were removed; remaining artifact hashes were regenerated and labelled as cleanup. Canonical media and useful failed screenshots remain.

## Run checks and capture new evidence

From the workspace root, using Node 26.10.0, pnpm 8.15.9 and Go 1.26.0:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm --filter @dashdevil/client exec playwright install chrome ffmpeg
pnpm test:browser
```

Every browser invocation writes to a unique ignored `apps/client/test-results/run-<UTC timestamp>-<random suffix>/`. Each scenario has its own `evidence/`; videos, screenshots and traces remain in the same run tree. The final manifest hashes actual output bytes and records the **tested** Git revision, dirty-worktree status/diff hash, fixture/configuration hashes and input snapshots, environment and run outcome. `baselineReference` is the comparison target, never a substitute for `testedRevision`. Repeated Playwright config evaluation shares that invocation's directory; the reporter finalizes against the resolved output after videos/traces close. CI uploads `apps/client/test-results`; it does not upload or rewrite the committed baseline archive.

Keep complete failed and successful run folders/CI artifacts for handoff; never replace an earlier run. Routine captures must not be copied over `docs/preservation/evidence`. Future logs stay in ignored run folders or CI artifacts, not commits.

The archived Stage 1 behavioral fixture version 1 mounted the original context/input/loop hooks. Current fixture version 2 tests the public simulation, session and keyboard boundaries with controlled platform RAF/time/randomness and simulation-only initial objects; scenario canvas 606×802/car top 682 is fixture setup, not measured browser layout. Seeded browser scenarios use LCG seed 21 or constant 0.4 for isolated coin capture. jsdom has no canvas/audio output, so its assertions prove behavior rather than presentation.

## Requirement-to-evidence checklist

| Requirement | Evidence and remaining limit |
| --- | --- |
| Initial/reset defaults, countdowns, lane bounds/aliases/held repeat/latest-key release | Executable retained boundary cases at 30/60/120 FPS; public first-countdown/browser HUD. |
| Acceleration/easing/release, spawning/random boundaries, difficulty growth/caps | Retained boundary cases at all three FPS; real-time video/audio. Exact multi-interval timing corrections belong to #22/#26. |
| Strict lateral/vertical/interpolated AABB, tilt-independent bounds | Retained boundary cases at all FPS; viewport-independent world/swept corrections belong to #26. |
| Coins/invincible consumption/fatal precedence, hit protection/blink/shake | Retained boundary cases at all FPS; public isolated Score 10 capture/audio and real-time hit/gameover recording. First invincibility expiry is measured directly in the 1950–2050 ms window. |
| Pause freeze, fatal gameplay freeze, delayed fade/shake overlay, restart/menu return | Retained boundary cases at all FPS and public browser path; pause-effect/input defects are classified below. |
| Textures/car/road/HUD/countdown/pause/gameover, resized presentation | Linked recordings/PNGs below; owner review passed on 2026-10-14. Acceleration PNG lacks HUD raster in that frame; virtual stale captures are explicitly unreliable. |
| Countdown/GO/lane/coin/damage/gameover/pause/resume/engine/boost/release audio, mute/unlock/optional audio | Actual parallel Web Audio sink recordings and public mute/persistence/unavailable-AudioContext checks. Controlled document.hidden output has RMS 0; native tab suspension is unproven; owner audiovisual review passed on 2026-10-14. |
| Failed evidence and retries | Compact failure/retry JSON plus useful original failed PNGs; raw diagnostics removed at user request. Future complete diagnostics stay in ignored run folders. |

Vitest, build/typecheck/lint and applicable Long Drive browser checks remain mandatory. Stage 1 recorded 41 passing checks/eight authorized defect characterizations and four Chrome scenarios. The current Stage 2 candidate records **84 passing checks**, one #26 collision characterization and seven Chrome scenarios (see checkpoints below). CI runs introduced checks on PRs. Native Go vet/test/build checks now run against the #24 scaffold (no Go gameplay tests yet). Shared Go/TS compatibility fixtures, generated-output checks and two-browser real-transport smoke remain **unavailable** until #27–#29 introduce their prerequisites; introduce them as mandatory when available. No full browser matrix, reference performance or multiplayer/capacity acceptance is claimed. The owner’s baseline review pass does not establish the later two-person multiplayer playtest gate.

## Corrections become mandatory in their owning slice

Baseline tests use explicit `test.fails` for accepted defects; this is historic characterization, not corrected acceptance. Correction #22 is now mandatory in ordinary `pnpm test` and CI. Until their owning implementation lands, `PRESERVATION_ENFORCE=23,26 pnpm test` (or `all`) activates later corrections; each introduced owner must become mandatory by default. An unexpected baseline pass already fails characterization. Add remaining owner-specific scenarios as the new seams appear.

| Owner | Mandatory corrected expectation / observed defect |
| --- | --- |
| #22 extraction | Implemented and mandatory: pause freezes all effects, HP clamps to zero with one fatal transition, active timers retain fractional remainder/cadence. Historical baseline defects remain in Stage 1 evidence. |
| #23 sessions/input | Independent sessions/reset/teardown; blur/hidden clears input/commands and pauses active play, freezes away countdown; fresh focus requires Space; suppress repeats/browser defaults/early commands, remove touch. Recorded defects include stuck acceleration, repeated/early pause, hidden countdown and browser defaults. Rename Long Drive, use accurate acceleration HUD and adapt reset presentation. |
| #26 world/track | Swept high-speed contacts (baseline obstacle tunnels), viewport-independent collision geometry and reproducible cadence/consumption. #22 provides the reusable geometry seam. |

## Human review

Owner signoff on 2026-10-14: **“review pass”** (Codex user message). The recording and environment metadata above identify the captured baseline; further reviewer environment/observations were not supplied. This acceptance applies to Stage 1 only.

Review the canonical [real-time playthrough video](evidence/browser-real-snapshots-artifacts/baseline-record-real-time--8dd01--for-later-human-comparison/video.webm), [isolated coin video](evidence/browser-verified-artifacts/baseline-isolated-coin-cue-from-public-seeded-gameplay/video.webm), [engine/gameplay audio](evidence/baseline-audio.webm), and [coin audio](evidence/baseline-coin-audio.webm). Compare [countdown](evidence/baseline-countdown.png), [acceleration](evidence/baseline-acceleration.png), [pause](evidence/baseline-pause.png), [game-over](evidence/baseline-gameover.png) and [resize](evidence/baseline-resize-pause.png) with a manual playthrough of the pinned baseline.

Record reviewer/date, tested revision and local changes, browser/version, OS/hardware, viewport/canvas, sound/unlock state and observations for textures, movement/tilt/acceleration, blink/shake/fade, HUD/overlays and every audio cue, mute and focus/resize behavior. Record disagreements or inconclusive findings explicitly. New human-review artifacts belong in their own run folder; source review or automated capture does not count as human audiovisual signoff.

## Stage 2 extraction checkpoint (#22)

[Structured checkpoint](extraction-checkpoint.json) pins implementation `68ffd73`, independent expectations, governing decisions, fixture/configuration hashes and all five browser attempts. Headless `packages/simulation` now drives playable Long Drive; read-only rendering and identified audio events consume its state. ES2022-only simulation typecheck, production build, client/simulation lint and **60 passing Vitest checks** pass; six historic #23/#26 defects remain expected failures. All **four actual Chrome scenarios** pass on clean committed final product source, including fresh countdown, keyboard/pause/HUD/mute, real-time hit/gameover/resize video and Web Audio capture, unavailable audio and isolated coin audio. Canvas remains 606×806 at 1280×900; 800×600 resize is captured.

Retained tuning/effects are distinguished from #22 corrections: active timer remainder, paused shake and fatal HP/event handling; restart also retains clearing a queued gameover pause. Core shake sampling cannot consume spawn randomness; interpolation preserves the original 60 Hz reference feel across rendering FPS. Continuous geometry/contact seams are provided; #26 owns their swept/world integration. #23 session/input ownership is a separate checkpoint. Original recordings remain unchanged.

The sandbox bind failure and a real-time timeout while source edits hot-reloaded the page are retained alongside the clean committed retry in `/private/tmp/dashdevil-stage2-evidence/extraction/`; future CI runs upload their own ignored run artifacts. Owner accepted Stage 2 extraction and integration audiovisual comparison on 2026-10-14: **“looks good”** (Codex user reply). Reviewer environment and detailed observations were not supplied. This does not establish supported-browser matrix, reference hardware or multiplayer evidence. Go/contracts/generated-output/real-transport checks remain unavailable until those components exist.

Event `observedAt` is explicitly a local step observation boundary, not canonical input/contact time; canonical parity remains unavailable until its owning world/authoritative work. Agent inspection of static countdown/pause snapshots found recognizable layout/road/car/overlay retained, with inconsistent single-frame HUD raster across original and candidate images; this remains inconclusive visual evidence. New captures and actual audio bytes are preserved; owner side-by-side audiovisual acceptance is recorded above.

## Stage 2 GameSession integration checkpoint (#23)

[Structured checkpoint](integration-checkpoint.json) records clean reviewed candidate `ebf6390`, independently reviewed expectations, fixture/configuration hashes and all five Chrome attempts. GameWorld now owns an independent GameSession through explicit commands and small UI subscriptions. Session teardown cancels schedules, detaches input and stops owned audio; shared mute/unlock settings remain app-owned. Long Drive replaces Solo Trip, touch controls are removed and acceleration HUD reflects actual input.

**84 Vitest checks pass**, with the #26 swept-contact defect retained as an explicit expected failure. #22 and #23 corrections are mandatory: full active elapsed time, monotonic first RAF, paused effects, clamped fatal HP, repeat/early-command suppression, latest-key ownership, fresh-key focus recovery, hidden/blur pause and frozen countdown, independent reset/disposal/audio and native interactive controls. The ES2022-only simulation typecheck, production build and lint pass. **All seven actual Chrome scenarios pass** on committed clean product source, including early Enter discard, restart/menu-return three-second countdowns, focus recovery and native Space on the sound control. Chrome 155.0.8059.79 ran on Apple M2/8 GB macOS; reference canvas remains 606×806 at 1280×900 and resized presentation is captured.

Complete runs, hashes, original failed focus-boundary assertion, focused retry, final clean retry, videos/screenshots/audio and final command logs are preserved outside Git in `/private/tmp/dashdevil-stage2-evidence/integration/`. The initial focus fixture sampled exactly one second at an initial RAF boundary; its countdown sample now occurs at 1.1 seconds. Separate session checks still enforce literal five/three-second deadlines at 30/60/120 FPS. Review fixes rebase accepted reset/restart clocks without delaying ignored commands; simulation-owned reset restores current viewport/base, fresh grass and countdown, preserves event identities and emits the first countdown cue once. Accepted restart applies synchronously so an earlier zero-elapsed RAF cannot lose it. The intermediate review capture unexpectedly reloaded during a watched test-file edit (Vite reconnect in trace); it is retained alongside the final seven-case retry run without concurrent writes. Original baseline archive is unchanged. Controlled blur/focus/visibility events in actual Chrome do not establish native OS tab suspension.

Technical integration checks pass; **Stage 2 exit is accepted** following the owner’s **“looks good”** reply on 2026-10-14 to the requested comparison of the updated preview, Stage 2 playthrough/audio and accepted baseline. Reviewer environment and detailed observations were not supplied. This completes #23; work on #24 is deferred at the owner’s request. Go tests, shared Go/TypeScript fixtures, generated-output checks and two-browser real-transport smoke remain unavailable until server/contracts/transport exist; supported-release matrix and reference-hardware acceptance remain unestablished.

## Stage 3 workspace move (#24)

[Migration checkpoint](monorepo-checkpoint.md) records the move to `apps/client`, native `apps/server` scaffolding, workspace dependency boundaries, orchestration and applicable preservation checks. Historical checkpoint paths remain unchanged as provenance of their tested revisions. #24 alone does not satisfy the complete Stage 3 gate; #25–#27 still own validated configuration, discrete tracks/world geometry and generated contracts.

## Stage 3 world geometry and track checkpoint (#26)

[Track checkpoint](track-checkpoint.md) records canvas-independent world centers, strict swept contacts, immutable seeded slices with separate consumption, exact time-based spawn anchors and safe retirement. The #26 tunneling correction is now mandatory. Shared version-1 generation fixtures run in both TypeScript and Go; full Go contact parity, generated schema verification and real transport remain owned by #27–#29. Actual Chrome high-speed/resize evidence complements retained Long Drive checks. Full Stage 3 and new human audiovisual comparison remain pending.
