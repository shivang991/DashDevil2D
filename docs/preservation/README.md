# Long Drive preservation

**Stage 1 accepted on 2026-10-14.** The project owner reported “review pass” in Codex after receiving the baseline review files. This records the owner’s audiovisual signoff and unblocks #22; no additional browser, hardware or observation details were supplied. Product gameplay and assets remain unchanged at this checkpoint.

## Authority and provenance

Baseline: `a68f27efd1d79ec8eea7ef0b0a6d8567606189dd`; original integration start: `23979fb648636a46e763240bafb3c1965749758c`. The original product source/public assets were compared against that baseline and matched.

Governing resolutions: [preservation](https://github.com/shivang991/DashDevil2D/issues/3#issuecomment-6118779020), [verification and approved seams](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139), [stage gates](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401), and [world geometry](https://github.com/shivang991/DashDevil2D/issues/5#issuecomment-6119616392).

Independent expectation reviewer `/root/baseline_expectations`, 2026-10-14, read these contracts and pinned original sources before reviewing tests. Expectations come from the contracts, rather than generated implementation results: HP 2, score 0, middle lane, empty road, 5-second first/3-second reset countdowns, coins worth 10, 2-second protection, 0.15-second held steering, 10× acceleration/80-unit upward target, 400 base speed (+15 per active second, capped 900), spawn interval 1.0 falling by 0.03 to 0.35, 0.45 coin probability, strict unrotated car/coin/obstacle bounds 50×80/28×28/48×40. Score/HP/targets/consumption/lifecycle decisions are exact; timer milestones allow 50 ms active time. Future Go/TS continuous positions permit only `0.000001 + 1e-12 * abs(expected)` world-unit error; events, identities, canonical times and wire bytes remain exact.

The [original artifact manifest](evidence/manifest.json), [environment](evidence/browser-environment.json), [audio scope](evidence/audio-capture.json), [controlled visibility measurement](evidence/audio-hidden-platform-fixture.json), [resize dimensions](evidence/resize-environment.json), and [failure/retry summary](evidence/failure-summary.json) retain provenance. Original actual Chrome canvas: **606×806 at 1280×900**, extra viewport 800×600. Hardware is Apple M2/8 GB macOS; comparable reference-machine qualification and native tab suspension are not claimed. The original archive was deliberately pruned at the user's request: logs, diagnostic traces, generated error-context Markdown and redundant videos were removed; remaining artifact hashes were regenerated and labelled as cleanup. Canonical media and useful failed screenshots remain.

## Run checks and capture new evidence

From `client`, using Node 26 and pnpm 8.15.9:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm lint
pnpm exec playwright install chrome ffmpeg
pnpm test:browser
```

Every browser invocation writes to a unique ignored `client/test-results/run-<UTC timestamp>-<random suffix>/`. Each scenario has its own `evidence/`; videos, screenshots and traces remain in the same run tree. The final manifest hashes actual output bytes and records the **tested** Git revision, dirty-worktree status/diff hash, fixture/configuration hashes and input snapshots, environment and run outcome. `baselineReference` is the comparison target, never a substitute for `testedRevision`. Repeated Playwright config evaluation shares that invocation's directory; the reporter finalizes against the resolved output after videos/traces close. CI uploads `client/test-results`; it does not upload or rewrite the committed baseline archive.

Keep complete failed and successful run folders/CI artifacts for handoff; never replace an earlier run. Routine captures must not be copied over `docs/preservation/evidence`. Future logs stay in ignored run folders or CI artifacts, not commits.

Behavioral fixture version 1 mounts actual context/input/loop hooks with controlled platform RAF/time/randomness and test-only initial objects; scenario canvas 606×802/car top 682 is fixture setup, not measured browser layout. Seeded browser scenarios use LCG seed 21 or constant 0.4 for isolated coin capture. jsdom has no canvas/audio output, so its assertions prove behavior rather than presentation.

## Requirement-to-evidence checklist

| Requirement | Evidence and remaining limit |
| --- | --- |
| Initial/reset defaults, countdowns, lane bounds/aliases/held repeat/latest-key release | Executable retained hook cases at 30/60/120 FPS; public first-countdown/browser HUD. |
| Acceleration/easing/release, spawning/random boundaries, difficulty growth/caps | Retained hook cases at all three FPS; real-time video/audio. Exact multi-interval timing corrections belong to #22/#26. |
| Strict lateral/vertical/interpolated AABB, tilt-independent bounds | Retained hook cases at all FPS; viewport-independent world/swept corrections belong to #26. |
| Coins/invincible consumption/fatal precedence, hit protection/blink/shake | Retained hook cases at all FPS; public isolated Score 10 capture/audio and real-time hit/gameover recording. First invincibility expiry is measured directly in the 1950–2050 ms window. |
| Pause freeze, fatal gameplay freeze, delayed fade/shake overlay, restart/menu return | Retained hook cases at all FPS and public browser path; pause-effect/input defects are classified below. |
| Textures/car/road/HUD/countdown/pause/gameover, resized presentation | Linked recordings/PNGs below; owner review passed on 2026-10-14. Acceleration PNG lacks HUD raster in that frame; virtual stale captures are explicitly unreliable. |
| Countdown/GO/lane/coin/damage/gameover/pause/resume/engine/boost/release audio, mute/unlock/optional audio | Actual parallel Web Audio sink recordings and public mute/persistence/unavailable-AudioContext checks. Controlled document.hidden output has RMS 0; native tab suspension is unproven; owner audiovisual review passed on 2026-10-14. |
| Failed evidence and retries | Compact failure/retry JSON plus useful original failed PNGs; raw diagnostics removed at user request. Future complete diagnostics stay in ignored run folders. |

Vitest, build/typecheck/lint and applicable Long Drive browser checks are mandatory now: **41 retained/capture API checks pass**, with **eight explicit authorized defect characterizations**, and four actual Chrome scenarios pass. CI runs introduced checks on PRs. Go tests, shared Go/TS compatibility fixtures, generated-output checks and two-browser real-transport smoke are **unavailable** because their server/contracts/transport components do not yet exist; introduce them as mandatory when available. No full browser matrix, reference performance or multiplayer/capacity acceptance is claimed. The owner’s baseline review pass does not establish the later two-person multiplayer playtest gate.

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

[Structured checkpoint](extraction-checkpoint.json) pins implementation `ab5e819`, independent expectations, governing decisions, fixture/configuration hashes and all four browser attempts. Headless `packages/simulation` now drives playable Long Drive; read-only rendering and identified audio events consume its state. ES2022-only simulation typecheck, production build, client/simulation lint and **57 passing Vitest checks** pass; six historic #23/#26 defects remain expected failures. All **four actual Chrome scenarios** pass on committed product source (the final run records only pending checkpoint documentation as dirty), including fresh countdown, keyboard/pause/HUD/mute, real-time hit/gameover/resize video and Web Audio capture, unavailable audio and isolated coin audio. Canvas remains 606×806 at 1280×900; 800×600 resize is captured.

Retained tuning/effects are distinguished from #22 corrections: active timer remainder, paused shake and fatal HP/event handling; restart also retains clearing a queued gameover pause. Core shake sampling cannot consume spawn randomness; interpolation preserves the original 60 Hz reference feel across rendering FPS. Continuous geometry/contact seams are provided; #26 owns their swept/world integration. #23 session/input ownership is a separate checkpoint. Original recordings remain unchanged.

The sandbox bind failure and a real-time timeout while source edits hot-reloaded the page are retained alongside the clean committed retry in `/private/tmp/dashdevil-stage2-evidence/extraction/`; future CI runs upload their own ignored run artifacts. Human side-by-side **extraction** audiovisual review remains pending. The baseline owner signoff does not establish Stage 2 visual/audio acceptance, supported-browser matrix, reference hardware or multiplayer evidence. Go/contracts/generated-output/real-transport checks remain unavailable until those components exist.
