# #38 Road Rage obstacle survival and deadline

Issue: [Play Road Rage through obstacle survival and its deadline](https://github.com/shivang991/DashDevil2D/issues/38). Starting revision `95494f7f1a7ea3e796bb11a564e454e85814f557`. The owner confirmed simulation step/result, shared Go/TypeScript fixtures and two-browser real-transport flows as test seams and approved this starting revision as review baseline. Implementation date: 2026-10-18 America/Phoenix.

## Governing decisions

[Movement](https://github.com/shivang991/DashDevil2D/issues/4#issuecomment-6119328249), [world/track](https://github.com/shivang991/DashDevil2D/issues/5#issuecomment-6119616392), [event precedence](https://github.com/shivang991/DashDevil2D/issues/7#issuecomment-6120100711), [configuration](https://github.com/shivang991/DashDevil2D/issues/16#issuecomment-6146866917), [verification](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139), [screens](https://github.com/shivang991/DashDevil2D/issues/19#issuecomment-6147750725), [stage gates](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401).

## Requirement-to-evidence map

| Requirement | Implementation and evidence |
| --- | --- |
| Reuse multiplayer foundations | Both modes now advance the same serialized server engine and reliable event/coverage transport, reconciliation session, canvas and input routing. Room creation, captured configuration, mode selection, readiness and rematch remain shared. |
| Defaults and independent coverage | Shipped defaults remain 3 HP, 1 obstacle damage, 2-second protection and 120-second deadline. Existing independent seeded track windows extend for both cars without a tether and retire behind their respective reachable regions. The existing shared independent-window fixture now explicitly selects empty cells to isolate its original track-only expectation. No placement draws, anchors or expected coverage change. |
| Obstacles and configured pickups | `race/road-rage.json` version 1 is consumed by both simulation suites. Contacts spend each obstacle per player even under protection. Equal-time damage takes the maximum once, with zero-duration protection retaining aggregation. Enabled hearts heal before damage and enabled coin score cannot decide a deadline tie. |
| Deadline/finality | The deadline participates in the existing canonical microsecond event group. All equal-time objects resolve first; zero HP precedes the deadline HP comparison. Shared fixtures cover a contact exactly at the deadline and one microsecond later, a deadline between ticks, both winning seats, ties, fatal precedence and immutable terminal state after input/disconnect/advancement. |
| Prediction and HUD | The same session predicts obstacle HP/protection, keeps deadline/death provisional until Outcome and accepts controls meanwhile. Road Rage renders remaining time and both HP displays without a Drag Race finish bar/line. `session/race.test.ts` covers provisional deadline and authoritative finality. |
| Actual transport and rematch | `pnpm test:rage` uses validated `infra/road-rage-track.json` (8 seconds, 6 HP, 200-unit slices, no clear distance; all other Road Rage values unchanged). Two Chrome clients use native room/keyboard actions, exceed 1,200 units of separation, take damage, compare matching HP-based deadline results, change modes and rematch on the same pair identities with new round/seed and fresh controls. `pnpm test:rage-default` separately exercises the unmodified shipped defaults through obstacle elimination. Both checks are mandatory CI steps. |
| Long Drive preservation | No Long Drive source, assets, defaults or accepted correction exceptions change. Existing 30/60/120 FPS checks and browser preservation remain mandatory. |

## Literal scenario derivations

Seed 1 places the first obstacle at 1200/lane 0, the second at 1600/lane 1 and the fourth at 2400/lane 0. Default car/object half-height sum is 60, so progress 1138 at 400 units/s contacts the first obstacle at 5000µs and reaches progress 1140. Starting at 1137.9996 postpones contact to 5001µs. Protection lasting through 5001µs suppresses the 5000µs hit; protection ending at 5000µs does not. The same contact still spends flags `2|8`; the opponent's later contact adds `16`.

For maximum simultaneous obstacle aggregation, a validated 2500-unit car overlaps the first and fourth lane-0 obstacles at progress 1800. The expected loss is one HP and both interactions are spent, even with protection duration zero. This is a deliberately labelled geometry fixture, not shipped tuning.

Seed 4 with equal obstacle/heart weights yields obstacle 1200/lane 0 and heart 1600/lane 0. A 900-high, 40-wide car with 40-unit objects overlaps both longitudinally at progress 1400. Its ordinary 150ms shift from middle to left reaches lateral −80 at 100000µs, contacting both objects together. One HP heals to two before one damage returns it to one; the deadline comparison therefore ties the opponent's one HP. Configured height 500 gives obstacle forward extent 270: starting at 928/1328 reaches the respective lane-0/lane-1 contacts at progress 930/1330 after 5ms, producing a simultaneous zero-HP deadline tie.

Continuous positions use `1e-6 + 1e-12 * abs(expected)`. HP, score, protection deadlines, outcome decisions/times/ticks and object identity/consumption match exactly. Existing protocol vectors and generated bytes remain unchanged. Independent review of these expectations is recorded in the companion review.

## Failure retention and acceptance scope

Raw command logs live in `apps/client/test-results/road-rage-implementation/`; each real-transport run retains its own manifest, configuration, server log, browser JSON, PNGs and videos. Original Go-cache permission failures remain retained; Turbo requires `--env-mode=loose` to propagate the temporary writable GOCACHE. Local listeners require execution outside the filesystem sandbox. An initial simultaneous-fatal fixture mistakenly used forward extent 260 instead of 270; both implementations rejected that expectation, which was corrected arithmetically without changing gameplay code. A tsx CLI probe could not open its IPC pipe in the sandbox; the `node --import tsx` read-only probe worked.

Initial product changes preceded test-seam confirmation; the initial checks are post-implementation regression checks, not red-first TDD. Later failures and fixes retain their actual evidence. No original failure is relabelled as passing.

This ticket completes obstacle survival/deadline behavior. Player-contact responsibility/damage remains #39. Stage 6 protocol/resource and operating coverage remains #40–#41; Stage 7 supported-release/OS supplements, reference-hardware/network measurements, capacity and two-person/manual audiovisual acceptance remain #42–#45. Chrome automation and agent image inspection do not establish full acceptance or those numerical performance targets. No failed gate authorizes progression.

## Final local validation

At source revision `69ba1d3`, applicable validation passed: **369 Vitest tests**, all Go tests/vet/build, shared Go/TypeScript fixtures, generated-output verification, lint, TypeScript and production build. The forced workspace run completed **15/15 tasks with no cache reuse**. The final exact-consumption fixture repair also passed both focused 14-case suites; the final browser test edits passed typechecking/lint and actual browser execution.

All **41 browser scenarios** pass: preservation **12**, transport **3**, rooms **5**, event groups **4**, finality **2**, race/correction **4**, objects **1**, contacts **2**, hearts **1**, maintenance **1**, boundaries **2**, lifecycle **2**, Road Rage deadline/rematch **1**, shipped-default Road Rage **1**. The original preservation capture was interrupted by a source-triggered Vite page reload; its trace shows a second Vite connection and a return to the menu. The complete source-frozen rerun passes all 12. The original rooms test assumed Road Rage remained a stationary placeholder: its repair preserves zero time/position/held keys during countdown and verifies 400-unit/s authoritative progress with released controls afterward. Both original failed attempts and passing reruns remain retained.

The final Road Rage checks use actual Chrome `HeadlessChrome/155.0.0.0` on Apple M2, Darwin 25.5.0 arm64, Node 26.10.0, pnpm 8.15.9 and Go 1.26.0. Each viewport is 1280×900; the actual backing canvas is 560×440 and displayed rectangle 512×402.703125. Clean local HTTPS uses a process-scoped certificate SPKI pin; WebTransport independently checks its certificate hash. No network impairment or performance percentile is inferred from these runs.

[Validation index](road-rage-validation.json) records source/fixture/configuration hashes, commands, retained failures, exact counts and limitations. [Independent review](road-rage-review.md) records zero remaining findings and independently derived expectations. [Deadline observations](evidence/road-rage/deadline-road-rage.json) and [default observations](evidence/road-rage/default-road-rage.json) retain both players' actual seeds, configurations, identities, HP, outcome and environment; matching manifests and server logs are alongside them. Final screenshots retain [deadline results](evidence/road-rage/deadline-result-0.png) and [shipped-default obstacle survival](evidence/road-rage/default-obstacle-survival.png). Original raw browser output and videos remain in the unique run directories indexed by the retained command logs.

This clears #38's obstacle/deadline gate while preserving playable Long Drive. It does not complete #39, the remaining Stage 6 checks, or Stage 7 acceptance.
