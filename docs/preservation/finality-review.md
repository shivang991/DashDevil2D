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
