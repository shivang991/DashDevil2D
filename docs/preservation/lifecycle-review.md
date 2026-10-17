# #35 independent review

Fixed point `096ba65992f57c123fcdab8054dab641157f2238`; implementation `82ba219`; finalized-room reload repair `6cbfbb8`. Reviews ran as separate read-only agents under the code-review skill. Browser execution remained with the primary agent.

## Standards

Reviewer `/root/standards_review`: no actionable findings. Reviewed ownership, terminology, configuration, protocol, preservation and evidence rules against CLAUDE.md, GLOSSARY.md, repository/package READMEs and preservation checkpoints. No hard documented-standard violation, concrete correctness defect or baseline design smell warranted a finding. Existing wire expectations remained unchanged; generated edits follow the schema; shared packages retain their boundaries; Long Drive source remains untouched.

## Spec

Reviewer `/root/spec_review`: no actionable missing requirement, scope creep or incorrect implementation identified in `096ba65…82ba219`. Stage 5 evidence was contingent on final checks; supported-browser/OS/network/manual full acceptance remains later work.

The parent then reproduced a finalized-room reload crash in the actual-browser test. Room state could precede initialization, violating “Recovering a finalized round shows its confirmed result.” `6cbfbb8` guards RaceView until Context exists. Independent follow-up review found no additional issue: valid Outcome processing already requires context, publishes immediately and stops input; the guard introduces no baseline or Connected prerequisite. Added page-error capture/assertions strengthen both scenarios and retain diagnostic errors on failure. The actual-browser rerun passed both scenarios.

## Independent expectation review

The Spec reviewer separately checked the lifecycle browser scenarios, public Go rejection regression and shared command-5 wire vector against the governing contracts. Countdown input discard, native Space activation, release/repress, ongoing authority, preserved seat session with newer pair/input generations, exact matching outcomes/times/cars, retained summary, cleared readiness, new round state, reused pair identities and replacement-guest isolation match the settled expectations. Platform visibility and datagram corruption fixtures do not establish physical suspension, network profiles or manual acceptance.

Initial gameplay uses baseline epoch 2 after lobby epoch 1; corruption in epochs 2 and 3 independently justifies expecting an installed epoch above 3. The unfinished-round Return to Lobby rejection followed by successful readiness proves the original pair remains usable.

Independent big-endian wire derivation (not codec output): `06 | 01020304 | 00000005 | 00000006 | 00 | 00000005 | 00000000 | 05 | 01 | 00`. The message discriminator plus 13-byte identity, two uint32 counters and three command bytes is 25 bytes, yielding prefix `00000019` and the literal fixture `0000001906010203040000000500000006000000000500000000050100`.

The Standards reviewer also rechecked `6cbfbb8`, the required CI step and protocol/README descriptions, with no findings.

Final outstanding findings: Standards **0**, Spec **0**. Runtime-discovered watchdog freshness, cross-epoch request-rate and cold-result ordering failures are retained with their fixes in the validation index; absence of static review findings is not substituted for executable evidence.

Final `b63971d` harness delta (HTTP exclusion, separate secure CI check and measured backing/displayed canvas metadata) received an additional independent Standards review with **0 findings**. Final executable evidence passed all 30 browser scenarios; the review reports did not substitute for those runs.
