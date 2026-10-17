# Independent #29 review

Review baseline `0a384877b9182491d98a22b83f9688abdcf0a76a`; initial implementation `1a08b1b`. Two independent agents applied the repository's code-review skill, with separate Standards and Spec axes. Both reviewed the followup fixes. Original reports are retained in `/private/tmp/dash29-standards-review.md`, `/private/tmp/dash29-spec-review.md` and their `-followup.md` files.

## Standards

Initial and followup review found no documented-standard violations or actionable baseline smells. No concrete correctness defect was identified by this axis. Repository instructions and ownership guidance override the skill's heuristic smell baseline.

## Spec

Initial review found one P2: reservation expiry removed the host and advanced room revision but did not notify the surviving browser. The expired pair's `close` was already consumed by `sync.Once`, so it could not supply that notification. A real two-seat regression reproduced the defect with the guest's authority acknowledgements continuing across the full 15-second grace. `expireLocked` now collects changed rooms; sweep and admission broadcast them after releasing the ownership mutex and after host reassignment. A prior attempted reproduction accidentally retained a four-second test-stream deadline; that original failure and the corrected red run are both retained.

The reviewer independently verified the existing #27 continuation fixture, positions/HP/scores, input disposition ordering and matching-tick Go/TypeScript CRC handling. The encoded baseline is 1,057 bytes; one reliable correction yields a 2,114-byte accumulated browser baseline total. No gameplay parity is inferred from the stationary fixture. The followup review also checked the shared per-pair queue budget, including writes in flight, and bounded baseline chunk scheduling that waits for drain rather than enqueueing a complete large transfer.

Followup: no remaining actionable Spec defect found. A draining/stalled transfer larger than 256 KiB would strengthen scheduler evidence; the current fixed diagnostic fixture does not exercise that size. Full browser-release/OS/certificate/network evidence and #28 parity remain explicitly open acceptance requirements, not a waiver or an implementation pass.

Standards: **0 findings**. Spec: **1 P2 resolved; 0 outstanding actionable findings**. Stage 4 acceptance remains incomplete for the evidence prerequisites in the checkpoint.
