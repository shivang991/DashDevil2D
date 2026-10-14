# #26 independent review

Reviewed candidate `24019b702c8ac8d8bfa9323f25e2322d9c8bcbf2` against fixed start `17e476dddfea41877e02454cbc21e1c08375659e`, 2026-10-14. Initial reports and corrections are retained in `/private/tmp/dashdevil-stage3-evidence/track/`.

## Standards

Reviewed `git diff 17e476dddfea41877e02454cbc21e1c08375659e...HEAD` through candidate `24019b7`, including the complete original implementation and review corrections.

No remaining documented-standard violations or actionable baseline smells identified. The initial findings are resolved:
- `apps/client/tests/simulation/track.test.ts` now imports both track helpers and fixtures through declared package exports. `packages/simulation/package.json` and `packages/contracts/package.json` export the intended seams; the client declares its contracts development dependency and `pnpm-lock.yaml` records the local workspace link. This follows the package-name boundary documented by root `README.md`.
- `packages/simulation/longDrive.ts` no longer projects generated objects into view coordinates; `apps/client/src/lib/gameRenderer.ts` owns that calculation. The duplicate projection formula is removed and rendering remains read-only, consistent with the preservation documentation.
- Root/server documentation now accurately describes Go generation and fixture checks, while preserving the distinction from later authoritative gameplay/transport work.

The pause fast path returns before iterating pending spawn/difficulty boundaries. Its regression covers an interval shrink that leaves a pending opportunity and asserts exact frozen state over twenty paused seconds. Resume command processing still precedes that return. Inspection found no new ownership, timing, retirement, consumption or reset defect: snapshots isolate mutable track containers; shared slices/cells remain frozen; PRNG closure ownership survives reset; generated distances remain independent of view size; protected/full-health contacts consume; fatal travel stops at contact; retirement does not rewind generator state or IDs.

Final Standards result: 0 findings. No runtime correctness blocker identified on this axis. This is source review; check execution and human audiovisual approval are separate evidence.

## Spec

Final Spec review — full diff `17e476dddfea41877e02454cbc21e1c08375659e...24019b7`.

0 actionable implementation findings. The previous review's independent seed, anchor, browser-seed and contact-order calculations remain valid. New package exports/dependency declarations implement the existing ownership boundaries; documentation accurately distinguishes generation checks from unavailable authoritative simulation/transport. Removing the duplicate world-to-view update preserves collision centers and moves projection to its intended renderer owner. Search confirms no production object-position consumer relies on the stale legacy `y` field once `distance` exists.

The new pause regression expectation is independently justified: initial interval 2 seconds yields no spawn at active time 1 second; the first difficulty ramp decrements the interval to 1 while retaining approximately 1 second of accumulated spawn time. Pausing before the pending opportunity processes must freeze that state. This follows the preservation/verification requirement “Paused/unfocused time does not count” and preservation of pause/effects. The paused fast path avoids repeatedly processing an epsilon-sized pending boundary without changing state. A read-only runtime check confirmed interval 1, next identity 1, unchanged state/time after a paused 20-second advance; resuming produced identity 1 at canonical `1000000` microseconds and distance `1140.0000000004145`, within the governing tolerance. The fix is directly related to time-based track migration, with no unrequested scope expansion.

Acceptance limitations remain explicitly disclosed, not new implementation defects:

- Human side-by-side audiovisual comparison is pending. Verification requires “Compare road/car presentation, motion/tilt, blink/shake/fade, HUD/overlays and audio with side-by-side playthroughs.” Automated evidence does not complete this gate.
- Generated-output/schema checks (#27), full Go simulation/contact parity (#28), and real two-browser transport smoke (#29) lack prerequisites. Stage 3 requires “generated contracts, validated configuration and discrete tracks work together”; the stage applicability rule requires unavailable checks to identify their missing prerequisites. Documentation does so, and makes no full Stage 3 or supported-browser/full acceptance claim.

Result: 0 actionable code findings; 2 disclosed acceptance-evidence limitations. No regression found in the reviewed changes.

Standards: 0 findings. Spec: 0 actionable implementation findings; two disclosed acceptance-evidence limitations.
