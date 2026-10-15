# Independent review of #28

Fixed point: `0a384877b9182491d98a22b83f9688abdcf0a76a`. Initial implementation: `e60271a`. Repair: `4453952`. Two independent agents applied `.agents/skills/code-review/SKILL.md`, separately reviewing Standards and Spec. They reviewed the full baseline diff, then the repair delta. Reference expectations were verified independently of production output. Public API probes remain in the evidence directory alongside original failed and passing tests.

## Standards

Initial P2: both input-admission methods called only mechanical encoding. An authenticated fresh press with control zero consumed sequence 1 and was ignored, although the existing semantic validator rejected it. The documented protocol rule requires mechanical plus semantic/context/stateful admission checks.

Fixed by invoking existing TypeScript `validateMessage` and Go `ValidateMessage` before advancing admission sequence state. A shared reference scenario verifies rejection followed by a valid press using the same sequence. Original red runs are retained in both languages. Native Go tests now explicitly disable test-result caching (`-count=1`), so changing external shared fixtures cannot be hidden by a cached test result.

The reviewer also noted potential retention of a large separation gap. The repair uses independent seeded placement cursors and per-car reachable windows, merging stable identities once in public snapshots. A shared ten-second reference scenario proves the exact six retained anchors.

Final reviewer: “Standards re-review: **0 remaining actionable findings**. The prior P2 is fixed. Public Go probing now confirms malformed control-zero presses return `false` and produce a rejected disposition. Both languages invoke semantic validation before advancing admitted sequences. Independent track cursors bound retained placement to each car’s window; merged snapshots preserve stable IDs without retaining the separation gap. No additional documented breaches or actionable baseline smells found.”

## Spec

Initial independent review verified all 15 original reference timelines, the two placement scenarios, seven seed words and six swept-geometry vectors. Additional public Go probes checked schedule invariance for one 0.9-second advance versus 90 increments, non-tick-aligned shift/repeat durations, and capped continuous speed growth. Two reference shift paths were refined to give the opponent NOS, avoiding reliance on deferred player-contact behavior.

Final reviewer: “Repair review of `4453952`: **0 actionable Spec findings**. Semantic validation now rejects a fresh press with `control=0` before sequence admission; the corrected sequence-1 NOS press remains accepted. Independent public Go API execution confirmed both decisions. The revised shift fixtures avoid player contact: the boosted opponent has sufficient longitudinal separation before lateral bounds overlap. Independently checked the new window expectations: after 10 seconds, positions are 8,000 and 4,000 within tolerance. Retained anchor centers lie within `[7940,8860]` and `[3940,4860]`, yielding exactly `[4000,4400,4800,8000,8400,8800]`. Refreshes every 0.5 seconds maintain NOS; their application ticks increase by 30 and times by 500,000 microseconds. Independent placement cursors preserve seeded identities while merged snapshots omit the intervening gap.”

This review establishes only the implemented-mechanics scope in [the checkpoint](mechanics-checkpoint.md). Actual supported-browser transport and complete multiplayer acceptance remain later gates.

Summary: Standards **0 outstanding** (initial P2 resolved); Spec **0 outstanding**.
