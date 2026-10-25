# Deferred seat-reset/input ordering repair

2026-10-24 America/Phoenix. Issue [#41](https://github.com/shivang991/DashDevil2D/issues/41). Pre-fix source `ec369fa`; repair `c3e3d7f`. Owner approved the Engine `ResetSeat → Submit → AdvanceTo` regression seam, alongside existing real-browser transport checks.

## Cause and repair

`ResetSeat` deferred identity, input generation and sequence changes while a canonical event group remained open. The transport immediately submitted the fresh input anyway, so validation used the old admission state. When the group later committed, resetting the seat could also invalidate newly queued controls or rewind its admitted sequence. This could strand NOS at “NOS ready” in either mode; the current pre-fix browser run failed Drag Race while Road Rage passed.

The server now switches input admission metadata immediately, invalidates pre-reset work once, and defers only observable control state. Inputs arriving after the reset remain in the existing bounded queue until the canonical group closes. Committing that reset does not overwrite the admitted sequence or invalidate fresh inputs. Replacement connection limits apply immediately; controls and unfinished groups remain hidden until committed. No client/test timing workaround or protocol/schema change is introduced.

## Deterministic regression

The approved public engine seam reproduces rejection of input 13 after resetting the sequence floor to 12, both for countdown priming and a replacement connection. Both cases failed before the repair. The fixed cases preserve the committed snapshot while the group is open; then press 13 and refresh 14 apply in order at exactly 33333 µs (tick start `2/60 s`). NOS remains effective. A separate regression proves a pre-reset queued press and stale generation are rejected while a fresh release is accepted. All focused tests passed 20 repetitions. An initial test checkpoint incorrectly compared pre-advance and pending-group snapshots; it was corrected to compare immediately before/after reset, preserving the actual visibility requirement. Original logs remain intact.

## Standards

Independent reviewer: no violations or actionable heuristic smells. Queue compaction safely writes behind iteration; retained inputs remain bounded. Deferred control state stays grouped, and admission changes are separated from observable state.

## Spec

Independent reviewer: no actionable defect or scope creep. Confirmed fresh identity/generation/sequence admission, exact 33333-µs application and 13/14 ordering, hidden unfinished groups, stale-input invalidation, Disconnect behavior, captured limits, queue bounds and immutable finality. These reviews assess the scoped repair, not full Stage 6 acceptance.

Review totals: Standards 0 findings; Spec 0 findings.

## Validation and retention

`pnpm check --force` passed all 15 workspace tasks with no cache reuse: 434 Vitest tests, all Go tests/vet/build, TypeScript, lint, generated-output and shared-fixture checks. Full simulation tests and Go vet passed separately. The unchanged dense two-browser WebTransport checks passed both Drag Race and Road Rage twice after repair, including large baseline drain and stalled-reader paired recovery. Related checks also passed: canonical groups 4/4, finality 2/2, lifecycle 2/2. Command results and original failures are retained in the [validation index](reset-order-validation.json).

Complete logs are retained under ignored `apps/client/test-results/reset-order-issue41/`. Each transport run retains its manifest with source revision/worktree hash, fixture/configuration hashes, actual environment, seeds, server logs and browser traces/screenshots. Source is Go-only; Long Drive source, configuration and assets are unchanged. No human audiovisual acceptance or reference Linux load/network acceptance is inferred. The unavailable reference environment and remaining operating-model requirements recorded in [capacity checkpoint](capacity-checkpoint.md) still block full Stage 6 exit. This repair supersedes its recorded unresolved dense NOS failure; original failed runs remain evidence, not passes.

## Owner-reported manual pass — 2026-10-24

After discussion of the outstanding load/network acceptance blockers, the owner reported: **“Tested it manually, mark pass.”** Record load/network acceptance as **PASS — owner-reported manual testing**. This supersedes the pending owner acceptance status above. Hardware, player count, duration, packet measurements and raw artifacts were not supplied; do not attribute measured thresholds or independently verified reference-hardware results to this report. Historical failed runs and unavailable automated evidence remain intact. Issue #41 is accepted for closure on the owner's manual pass; this record alone does not certify every broader Stage 6 requirement.
