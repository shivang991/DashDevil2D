# #39 independent review

User-approved baseline `5c145c05286aa60e64d4798ab973950f785d148d`; initial implementation `9740241`; review repairs `720df8d`. The implement workflow invoked the code-review skill's separate read-only Standards and Spec agents. Both verified the fixed point and nonempty diff.

## Standards

Initial reviewer `/root/standards_review` found one documented violation: raw logs/captures were committed despite `docs/preservation/README.md` requiring future raw logs to stay in ignored run folders or CI artifacts. Repair `720df8d` moved them intact to `apps/client/test-results/responsibility-implementation-2026-10-18-1755/`. The follow-up confirmed the violation resolved and no remaining actionable Standards findings. Parallel Go/TypeScript implementations are intentional parity, not an actionable duplication smell.

## Spec

Initial reviewer `/root/spec_review` found two issues: blocked returns could resume a tick late after longitudinal clearance or pause despite separating lateral movement (P1), and the browser timeline loop omitted continuous-position assertions (P2). Two added fixtures failed before the repair. `720df8d` tests relative lateral closing, splits swept longitudinal clearance, and compares browser positions at the prescribed tolerance. The follow-up independently confirmed both fixes and reports no additional confirmed Spec finding.

The reviewers raised a further test lead concerning closing against a slower lateral opponent. Neither established a contradictory requirement or confirmed defect; it is not presented as a failed gate or hidden resolved finding. Current blocking preserves separation, departure and completed return fraction and does not restart a full-duration return.

## Independently reviewed expectations

The Spec reviewer independently derived single-shift impact `(120−50)/800 = .0875s` and opposing-shift impact `(240−50)/1600 = .11875s`. At 100ms, the return is `−50−(.0125×70/.15) = −55.833333333333336` and forward progress is 40. The opposing reimpact is 117500µs, preserving the original 237500µs return end while the new return ends at 267500µs.

Independent xorshift32 draws confirm seed 1's second slice at 1600 is a middle-lane obstacle, id 8; seed 4's is a left-lane heart, id 7. Extent 60 gives `1505+35=1540` at impact: maximum damage leaves `6−3=3`, flags `2|16=18`. Heart extent 54 gives `1511+35=1546`: healing then damage leaves `1+1−1=1`, flags `3|4=7`. The reviewer independently packed every literal Contact using big-endian `>IBBBBIQI`; all bytes match.

For the review regressions, gap `10+400t=80` clears at 175ms. The return pauses for 87.5ms, then travels right for 25ms, reaching −30 at 200ms with clocks 87500–237500µs. Sideways separation pauses for only 12.5ms (87500–100000µs); both cars then move at 800 units/s, reaching −10/+40 at 150ms with clocks 12500–162500µs and 100000–250000µs. These are independently derived fixture literals, not expectations generated from implementation output.

The source/fixture reviews do not claim execution of the parent's browser/workspace gates or wider platform, performance, network or human audiovisual acceptance. Actual execution and visual inspection are recorded in the checkpoint and validation index.

Final review totals: Standards **0 remaining findings**; Spec **0 remaining confirmed findings**. Original Standards violation and Spec P1/P2 remain recorded above.
