# Issue #31 independent two-axis review

Baseline: `33f1f41945e1943f7bcfa2acc7f9d02e9205571a`. Initial reviewed implementation: `6f83763`.

## Standards

No documented-standard breaches. One judgement call: possible duplicated capped-speed integration inside each engine, between ordinary advancement and the new finish solver. Addressed by calling each language's shared `forwardDistance` from both paths.

Separate correctness observations: a valid Outcome overtaking queued Disposition messages could produce an authority-gap failure after finality; and keyboard blur retained a deduplication entry when a key was released off-window. The authority-delay browser fixture reproduces the first failure, retaining `finality-red.log` and its original browser artifacts; post-outcome dispositions are now discarded. Blur/visibility/canvas-focus loss clear physical-key bookkeeping and release controls while repeat events remain suppressed.

## Spec

One P2: ordinary rendering lacked interpolation between simulation ticks, separately from #34's deferred correction smoothing. Addressed with separate interpolated `renderedCars` positions; the session's tick-based geometry remains unchanged. `interpolation-red.log` and `interpolation-green.log` retain the failing and passing behavior check.

The reviewer independently checked all six shared race fixtures against their initial conditions and arithmetic and found them correct. No scope creep was identified. Road objects/contact/full correction/rematch acceptance remain with #32–#35 as documented.

Initial totals: Standards 0 hard breaches, 1 judgement call; Spec 1 P2. Follow-up review and final verification are recorded after the fixed source is committed.

## Final follow-up at `9083eb5`

Standards: **0 outstanding** documented breaches or judgement calls. Original correctness observations are fixed. A further P2 ordering case was reproduced through an actual verification mismatch and delayed replacement baseline: Outcome could send a terminal acknowledgement in the retained old epoch during recovery. Terminal acknowledgement now waits for complete baseline installation/Ready; valid older-epoch acknowledgements already in flight are discarded. The reviewer independently verified the fix.

Spec: **0 outstanding** actionable findings within #31's scope. The reviewer confirmed the final incremental changes and retained the independent approval of the six literal race scenarios.

[Original and follow-up reports](evidence/race/standards-review.md) are retained separately alongside [final Standards verification](evidence/race/standards-final.md) and [final Spec verification](evidence/race/spec-final.md).

Totals: Standards **0 outstanding**; Spec **0 outstanding**; no remaining worst issue within either axis.
