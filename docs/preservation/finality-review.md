> Final status: the #36 issue gate passes under the approved #11/#14 amendment. Earlier blocked reports below are retained history; see the final section and validation manifest.

# #36 independent reviews

Reviewed implementation: `git diff 76325f95f050f89d604e92241192f07d9c7fc77a...d183707`. The implement skill required code-review; its separate Standards and Spec agents ran independently after the implementation commit. Final full checks and browser validation are indexed in `finality-validation.json`.

## Standards

No actionable findings. The diff follows the documented repository rules and introduces no meaningful baseline code smell. Paired endpoint changes preserve tangency exclusion. The browser fixture's documented wire offsets and scoped transport overrides follow existing patterns. This is the Standards agent's conclusion, not a claim that the Spec gate passes.

## Spec

The first Spec review found no actionable implementation defect or scope creep in the committed changes, and independently checked these literal expectations:

- Finish center `400−40=360` at speed400: centers350/349.9996 cross at25000/25001us; swapped centers swap the winner.
- Center349.99992 crosses at25000.2us, rounding to25000us; 25000.6us rounds25001, while25000.499us rounds25000. Exact half-up conversion is tested separately.
- Independent integer xorshift32 seed1 lane words `00042021,9dcca8c5,8ef917d1,25b2331a,77877125,9e6002cb,b4b84b8a` map to lanes0,1,1,0,1,1,2. Objects at20/80 overlap center40 with extent60: two damage changes HP3→1 or clamps HP1→0.
- Obstacle794 entry center734 equals heart800 entry center734 with size52. From732 both contact at5000us; full HP3 caps at3 before damage to2.
- At64Hz, `333.75+400/64=340`, the obstacle entry center at15625us.
- Lateral `71/800=.08875` equals longitudinal `(410−374.5)/400=.08875`: damage and finish are simultaneous.

**Follow-up found one blocking Spec issue.** The parent probed equal canonical finish times on opposite sides of a raw tick boundary, then the independent Spec agent confirmed the defect and withdrew its preliminary no-findings conclusion as a complete issue-gate assessment. At60Hz, boundary1 is16666.666…us, inside canonical bucket16667 `[16666.5,16667.5)`. Crossings16666.6/16666.8us must tie; both existing engines instead award seat0. Executable public-interface probes and their failing logs are retained in `evidence/finality/cross-tick-probe.{mjs,go}` and `evidence/finality/logs/cross-tick-{ts,go}.log`.

The reviewer confirmed that widening only the sweep horizon is insufficient: next-boundary inputs with canonical time16667 must precede that bucket's collision resolution. A correct scheduler must carry the unfinished bucket across the raw boundary, admit same-time inputs first, use piecewise trajectories through shift/return completions, resolve pickups/healing→damage→terminal once, and retain a raw continuation cursor without repeatedly rounding tick duration. Checkpoint visibility and complete recovery continuation while a group is pending need an explicit governing contract amendment before implementing that scheduler. The owner has been asked to approve that amendment, rather than silently changing protocol/checkpoint semantics.

Additional required regressions are fatal obstacle plus later same-bucket heart, distinct same-bucket obstacles, contested same-bucket pickup, adjacent buckets at16667.5us, equal-time input admission and a shift/return boundary inside the group. Passing existing Go/TypeScript parity fixtures does not satisfy these missing scenarios.

Standards: 0 findings. Spec: 1 blocking canonical-group/checkpoint issue. **#36 remains open; its gate has not passed.** No subsequent stage may treat this checkpoint as acceptance.

## Final approved continuation review

The owner approved the scheduler/checkpoint amendment, recorded on [#11](https://github.com/shivang991/DashDevil2D/issues/11#issuecomment-6239984034) and [#14](https://github.com/shivang991/DashDevil2D/issues/14#issuecomment-6239984266). The earlier blocked assessment above remains as history. Final production implementation revision is `fbb8cf3` (final test readiness commit `0d13544`), compared with original base `76325f95f050f89d604e92241192f07d9c7fc77a`.

The independent Spec reviewer checked split finishes at16666.6/16666.8us (both16667), split healing/obstacle entry, return-origin distinct damage, shift/return completion and next-bucket finishes. Follow-up review found a genuine additional defect: a NOS follower released by lateral clearance at16666.8us discovered a fatal obstacle at16667.1us, then incorrectly reconstructed the preceding raw-boundary sample with the new multiplier. Public regressions independently expect `333.33304 + 400/60 = 339.99970666666667`; both engines now preserve recent physical segments and meet that value. Red and green logs are retained.

The parent's lifecycle precision regression found that settling a cutoff bucket shifted a requested5000us checkpoint to5001us. `StopAt` now completes only same-canonical gameplay while restoring the requested raw cutoff position/time if no earlier gameplay outcome wins. The independent reviewer checked this final path, pending checkpoints, resets and immutable outcomes and found no remaining actionable Spec issue.

A final browser attempt found insufficient coverage after client replay at a canonical boundary. A targeted diagnostic retained the actual tick44 client positions366.6669333333332/293.33346666666654 against a server window233.3333333333332..1626.6666666666665. Strict coverage bounds had zero room for reconstructed positions. Both engines now generate and retain one maximum-speed movement tick of complete headroom, and transport transmits matching bounds. Validation stays strict. Independent public-session and Go regressions cover this exact discrepancy, forward generation, backward retention and exact consumption flags. Substantially insufficient coverage still fails. Both initial browser failures and diagnostic failures remain retained.

Standards review identified duplicated phase-sensitive position restoration; `restorePosition` now serves both Go callers. Its final assessment, including the coverage change, is **0 actionable findings**. The independent Spec review's final assessment is **0 actionable findings**, contingent on the parent's required full and browser checks. Those final results are indexed in `finality-validation.json`; the historical preliminary pass is not substituted for them.

A retained room-browser failure occurred before guest admission: Enter was pressed before the asynchronously initialized Join Room button became enabled. The final harness waits for that existing enabled state in both native Enter tests. Independent Spec review confirmed it preserves keyboard submission and all assertions; production behavior is unchanged. The final browser run records the corrected harness at `0d13544`.
