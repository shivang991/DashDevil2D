# #37 independent review

Fixed point `25a9a96af978a8423debac1e13a79f0b0c79785c`; initial implementation `8db2a7e`; equal-time repair `7b85833`. The implement skill invoked the code-review skill's separate read-only Standards and Spec agents. The primary agent owns validation and retained original failures.

## Standards

Reviewer `/root/standards_review` found no actionable documented-standard breach, baseline smell or concrete correctness issue in the initial diff. Its independent review of `8db2a7e...7b85833` also found none: the repair applies one lifecycle boundary rule, preserves active seats through an open instant, and resolves earlier groups before connection changes. The existing fixture mutex repair follows room-owner locking requirements.

## Spec

Reviewer `/root/spec_review` identified one initial P1 finding: pure grace expiry could finalize at T before a disconnect or leave also timestamped T. The opposite arrival order produced abandonment instead of forfeit, violating the governing equal-time rule. The parent reproduced it using public admission, real paired transports, an injected clock, and recovered self-contained outcomes. The expiry-first red result was forfeit at exactly 2000000µs.

`7b85833` holds every active lifecycle group open until its authoritative instant closes. Admission and paired baseline acknowledgement still reject at the deadline. Both expiry/disconnect permutations now return abandonment at 2000000µs. The independent follow-up review reports zero remaining findings in that repair and no scope creep.

The parent subsequently reproduced a stale asynchronous input-stream creation overwriting a replacement's writer. The Spec reviewer independently confirmed additional state mutation after awaited initial Input, Ready/outcome acknowledgement, Handshake and barrier acknowledgements. Those continuation guards and final review status are recorded after their repair.

## Independent scenario expectations

The Spec reviewer independently checked literal expectations against the governing decisions:

- Recovery admission at deadline−1µs succeeds; at deadline and deadline+1µs it fails. Ticket retries preserve the original deadline.
- Both channels with baseline acknowledgement must initialize strictly before grace. Acknowledgement at/after grace cannot mark a seat connected or revive its credential.
- Expiry at 999999µs forfeits before the known 1000000µs gameplay finish. Equal-time finish wins, and expiry at 1000001µs cannot replace that final gameplay result.
- Both grace/disconnect processing orders at the same clock instant abandon at 2000000µs; advancing the observation clock to close the group does not change its event timestamp.
- A reserved host blocks new admission and retains host until grace; expiry transfers host, and reused code `0042` identifies a fresh internal room session that cannot be recovered with old credentials.
- Explicit-leave abandonment is recoverable by a still-reserved opponent; new-guest result isolation remains covered by the retained lifecycle scenarios.
- Browser warning/expiry, host transfer, idle exemptions and recovered abandonment expectations match their labelled short-room-timer fixture. They do not establish physical suspension, exact browser microsecond timing or manual acceptance.

Final async repair and validation reports follow in the final section.

## Final asynchronous callback review

Repair `ab502fc` rechecks local pair generation after awaited stream acquisition and writes, before any current-session writer, buffer, timer, focus, verification or recovery mutation. The delayed-stream test reproduces the original bug and passes after repair: the replacement receives both rounds' Input frames, and the obsolete stream receives none. The reviewer explicitly checked that the fake admission's reused wire identity still exercises local generation supersession correctly.

Standards reviewer `/root/standards_review`: zero actionable findings through `ab502fc`; the guards preserve ownership, stale stream cleanup handles rejected cancellation, and full-page screenshots improve evidence readability.

Spec reviewer `/root/spec_review`: zero remaining findings through `ab502fc`; every identified stale-generation continuation gap is repaired, with no additional implementation mismatch or scope creep identified.

Final totals: Standards **0** findings; Spec **0** remaining findings. The original Spec P1 and later independently audited callback gaps remain documented above with their reproductions and repairs.
