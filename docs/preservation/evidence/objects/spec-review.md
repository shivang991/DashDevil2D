# Spec review — issue 32

Reviewed `git diff 8f64dfeaad762039ea410b5cc54186a14d72f9d9...ab1f8141752db6366766a3e4a08264e1e4944eae` independently, including simulation, authority transport, session reconciliation, rendering and test changes. Final reviewed ref: `ab1f814`. Browser execution was performed by the implementing agent; this review inspected the retained passing object/heart logs and test routing, and does not claim to have executed the browser suites itself.

## Primary findings

No unresolved spec findings. The initial review identified missing shared coverage for exact-time damage/finish precedence, additive simultaneous obstacles, and contested enabled coins. Four additional fixtures now close that gap; their expected values were independently checked below. The governing contract says: “Zero HP takes precedence over a simultaneous finish crossing”; “Distinct simultaneous obstacle hits add together”; and “consume the coin without awarding either player points.” [Outcome decision](https://github.com/shivang991/DashDevil2D/issues/7#issuecomment-6120100711).

No confirmed incorrect product behavior or scope creep found. Player contact physics (#33), full presentation smoothing (#34), final Stage 5 acceptance (#35), and broad manual/performance acceptance were deliberately excluded. The diagnostics exposure for browser evidence fits this slice.

## Independent fixture audit

All twelve fixture expectations pass an independent arithmetic/spec audit. This conclusion comes from reconstructing placement draw order and collision geometry, rather than treating Go/TypeScript agreement as an oracle.

For seed 1, independent xorshift32 words begin `270369, 67634689, 2647435461, 307599695, 2398689233, 745495504`; lane draws select lanes `0, 1, 1` for the first three ordinary opportunities. Reserved hearts consume one draw before equal-distance random opportunities. Object identity is `sliceId * 3 + lane + 1`. Default speed is 400 units/s. Car half-length is 40; obstacle half-length 20; default heart/coin half-length 14. All unmentioned scores remain zero.

| Fixture | Independently derived expected values | Verdict |
| --- | --- | --- |
| One obstacle spent separately | First default obstacle: distance 1200, slice 1, lane 0, id 4. Entry center 1140; starts 1138/1130 yield 5/25 ms. Flags 10 then 26; HP 2/2; final progress 1158/1150. | Pass |
| Exact heart contention | Reserved heart at 800 is slice 2, lane 1, id 8. Entry center 746; both start 744 and contact at 5 ms. Flags 7; HP remains 1/1; final progress 764/764. | Pass |
| Full-health denial | Same heart; contacts 5/25 ms. First collector stays at 3 HP and consumes it; second stays at 1. Flags 7; progress 764/756. | Pass |
| Healing before damage | With spacing 397, slice 2 obstacle at 794 is lane 1/id 8; reserved heart at 800 is slice 3/lane 1/id 11. Enlarged heart half-length 26 gives shared entry center 734. Start 732 contacts at 5 ms: heal 1→2, damage 2→1. Flags 10/7; other HP 3; progress 752/20. | Pass |
| Enabled coin | First opportunity at 400: slice 1/lane 0/id 4. Entry center 346 from 344 gives 5 ms. Flags 5, score 10/0, HP 3/3; progress 364/20. | Pass |
| Fatal hit before later heart | Same obstacle enters at 5 ms, default-size heart at 35 ms. HP 0/3; result seat 1, tick 1, time 5000; progress stops at 734/2; only obstacle flags 10. | Pass |
| Simultaneous elimination | Default first obstacle entry at 5 ms for both from 1138. HP 0/0, flags 26; tie result 2 at tick 1/time 5000; progress 1140/1140. | Pass |
| Lane return | Tick 9 starts at 150 ms, lateral -60 moving at -400 units/s. Combined half-width 49 requires center -71, reached 27.5 ms later. Contact 177500 µs, flags 10, HP 2/3. Advance to 200 ms yields progress 1161/20. | Pass |
| Contested enabled coin | Both enter the first coin at center 346 from 344 at 5 ms. Shared consumed flags 5; scores 0/0 and HP 3/3; progress 364/364. | Pass |
| Distinct simultaneous obstacles | Independent odd-numbered seed-1 lane draws are 0,1,1,0,1,1,2,0. With spacing 20, left-lane obstacles at 20/80 are slice 1/id 4 and slice 4/id 13. Center 40 overlaps both with half-extent 60 at time zero; lose 2 HP, flags 10 each. One tick gives progress 46.666666666666664/6.666666666666667, HP 1/3. | Pass |
| Fatal contact exactly at finish | Lateral velocity -800 units/s reaches -71 at 88.75 ms. Combined half-width 49 begins overlap with lane -120 there. Progress 374.5 + 400×.08875 = 410; front edge 450 reaches finish simultaneously. HP 0/3; seat 1 wins at 88750 µs, tick ceil(5.325)=6. Opponent progress 35.5. Obstacle id 4 flags 10. | Pass |
| Surviving contact exactly at finish | Same placement/time/geometry. HP 3→2 before outcome, so seat 0 wins at 88750 µs/tick 6. HP 2/3, progress 410/35.5, obstacle flags 10. | Pass |

The nonterminal fixtures' expected progress is `start + 400 * elapsed`. All terminal fixtures stop both cars at the first terminal instant. Event ordering and flags match shared pickup bit 4 and per-seat obstacle bits 8/16.

## Governing sources

- [World, seeded layout, dimensions, hearts and per-player obstacles](https://github.com/shivang991/DashDevil2D/issues/5#issuecomment-6119616392)
- [HP, pickup contention, chronological events and terminal precedence](https://github.com/shivang991/DashDevil2D/issues/7#issuecomment-6120100711)
- [Prediction repair and once-only feedback](https://github.com/shivang991/DashDevil2D/issues/12#issuecomment-6124581405)
- [Configuration and fixed rules](https://github.com/shivang991/DashDevil2D/issues/16)

Primary findings: zero unresolved; initial verification gap resolved by four independently audited shared fixtures.

## Final incremental review

The additions through `ab1f814` remain in scope. `bb64af2` adds visible-object screenshots and uses discrete steering presses with lane-completion checks in the optional heart scenario; it changes evidence collection, not gameplay rules. `ab1f814` excludes `objects.spec.ts` from the HTTP-only preservation harness, which has no real paired transport, and preserves the existing twelve preservation scenarios. The object test remains explicitly selected by the real-transport harness through `test:objects` and `test:hearts`; neither required scenario is silently discarded. Retained `logs/objects-final-01.log` and `logs/hearts-final-01.log` each report one passing actual-browser scenario. The earlier wrong-harness failure remains retained as diagnostic evidence. No new spec finding from these changes.

Final CI supplement: independently inspected the subsequent working-tree change to `.github/workflows/preservation.yml`. It adds unconditional `pnpm test:objects` and `pnpm test:hearts` steps after the existing race check in the PR/main-push workspace job. Existing checks and always-uploaded test artifacts remain intact. This makes both real-transport scenarios mandatory and closes the routing requirement without changing product or test behavior. No new spec finding.
