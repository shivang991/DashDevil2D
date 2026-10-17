## Standards

No documented-standard breaches found in the reviewed diff (excluding tooling-enforced checks).

One baseline judgement call: **possible Duplicated Code** in `packages/simulation/multiplayer.ts:201–205`: the new `forwardDistance()` repeats the capped-speed integration already in `advanceTo()` at lines 181–184 (`normal`, `ramp`, then ramp distance plus capped remainder). The finish solver and movement integrator should call the same helper so a later change cannot silently make finish times diverge from movement. The same duplication exists in Go's new `forwardDistance` versus its movement loop. Cross-language duplication is required for independent parity, but duplication within each engine is avoidable.

## Material correctness findings (separate from Standards)

- **[P1] Discard late Disposition records after finality** — `apps/client/src/transport/PairedConnection.ts:261–265`. Outcome travels on control while dispositions travel on authority, so Outcome can overtake queued dispositions. `RaceSession.disposition()` becomes a no-op after finish, leaving baseline authority unchanged. The second subsequently received disposition then fails the contiguous-authority check, disconnecting a valid completed race. Event/Coverage/Barrier already guard finality; Disposition needs equivalent handling and an ordering regression.
- **[P2] Clear keyboard deduplication on focus loss** — `apps/client/src/components/RaceView.tsx:20–23`. Blur releases transport controls but retains `pressed`. Holding W while switching away, releasing it outside the window, then returning and freshly pressing W results in a discarded press because the missing keyup leaves W in that Set. Clear physical-key bookkeeping at the blur/visibility boundary while preserving the fresh-key requirement.
