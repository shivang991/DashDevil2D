# #39 Road Rage input-history collision responsibility

Issue: [Apply Road Rage input-history collision responsibility](https://github.com/shivang991/DashDevil2D/issues/39). Baseline `5c145c05286aa60e64d4798ab973950f785d148d`, approved by the owner for review. The owner confirmed shared TypeScript/Go simulation APIs with timeline fixtures and real-browser transport/prediction/preservation test seams. Implementation date: 2026-10-18 America/Phoenix.

## Governing decisions

[Movement](https://github.com/shivang991/DashDevil2D/issues/4#issuecomment-6119328249), [collision responsibility](https://github.com/shivang991/DashDevil2D/issues/6#issuecomment-6119852616), [event precedence](https://github.com/shivang991/DashDevil2D/issues/7#issuecomment-6120100711), [canonical time](https://github.com/shivang991/DashDevil2D/issues/11#issuecomment-6124322966), [verification](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139), [stage gates](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401).

## Requirement-to-evidence map

| Requirement | Implementation / evidence |
| --- | --- |
| Shared qualifying history | Existing accepted fresh presses now populate the already-versioned Contact continuation. Retaining the latest entry and monotonically increasing order is sufficient to select a victim without an unbounded log. Both engines retain their diagnostic latestPress view. Edge steering, repeated presses, refresh/release, automatic shifts and ignored return inputs are covered by shared fixtures and existing input timelines. |
| Authoritative ordering and late input | Existing stable Player 1 then Player 2 application remains before contacts. Shared timelines include reverse arrival, consecutive same-player inputs, and an input accepted after impact that cannot rewrite damage. |
| Episodes, exemptions and protection | Player impact starts an episode; separation ends it at movement endpoints as well as before contact search. Dual shifts and tailgating cause no player damage. Eligible episodes select the opponent of the latest input once, even if protection suppresses HP loss. Return/reimpact timelines verify fresh decisions and preserved returns. A return geometrically blocked at contact pauses only its remaining travel: departure/origin/target and completed fraction remain; start/end clocks shift together by the blocked interval, rather than starting a fresh full-duration return or teleporting through the opponent. |
| Equal-time precedence | Player damage participates in the same canonical event group as road objects and the deadline. Healing resolves first, maximum Road Rage damage applies once (including zero-duration protection), then terminal evaluation. Fixtures include simultaneous heart/player contact, obstacle/player damage, fatal player damage, and impact exactly at deadline. |
| Reconciliation and verification | Server dispositions/events/checkpoints carry coherent Contact state. RaceSession restores and reconstructs it alongside cars and consumed objects. A session regression verifies provisional victim HP reversal. Literal Contact values and big-endian wire bytes are checked in both languages. |
| Real browsers | `test:responsibility` is a mandatory CI step. Chrome executes every shared timeline; three two-context native-room/keyboard flows verify either victim seat, protected reimpact, renewed damage after protection, and provisional damage reversed by application-delayed authority. The 250ms authority delay is a delivery fixture over actual WebTransport, not a network envelope or performance measurement. |
| Long Drive preservation | No Long Drive gameplay, assets, defaults, or correction exceptions change. Existing preservation and transport/contact/regression gates remain mandatory. |

## Literal expectations

With lane spacing 120 and width 50, a default 150ms shift travels 800 units/s. A single shift closes the 70-unit lateral gap in 87.5ms; opposing shifts close 190 units at 1600 units/s in 118.75ms. At 100ms, the first shift has returned for 12.5ms at 70/0.15 units/s, giving lateral −55.833333333333336 and progress 40. A second opponent shift starting at 100ms reaches the returning first car at 117500µs; it returns until 267500µs while the original unblocked return still ends at 237500µs.

Seed 1 has an obstacle at 1600 in middle lane, id 8. Both cars starting at progress 1505 reach progress 1540 at the 87500µs player impact; the middle car simultaneously contacts the obstacle's 60-unit forward extent. With configured 6 HP, obstacle damage 2, player damage 3 and protection duration zero, it ends at 3 HP once, and the obstacle's Player 2 interaction is spent (`2|16 = 18`). Seed 4 with equal obstacle/heart weights has heart id 7 at 1600/left. Starting at 1511 reaches the heart's 54-unit forward extent at the same impact; healing 1 HP to 2 precedes the 1 HP player hit, leaving 1 HP.

Contact encodings are independently packed from the published schema: big-endian u32 episode, four u8 fields (flags, blockedSeat, latestSeat, latestControl), u32 sequence, u64 microseconds and u32 order. Continuous positions use `1e-6 + 1e-12 * abs(expected)`; decisions, HP, canonical times, contact state, wire bytes and consumption match exactly.

## Failure retention and scope

All raw attempts, including failures, are retained under `apps/client/test-results/responsibility-implementation-2026-10-18-1755/logs/`; browser harness runs retain manifests, server logs, browser results, screenshots and videos under their unique `apps/client/test-results/transport-*` directories. The first test incorrectly passed an extra seat field into Input, causing validation rejection; the corrected valid-input case was rerun against the original implementation and failed for the actual missing damage behavior (`valid-input-red.log`) before the green check. Later scenario expansion is regression verification, not all red-first TDD.

Retained failures include the default Go-cache sandbox denial, transport listener sandbox denial, an omitted Go fixture struct field, new observation metadata affecting old diagnostic assertions (kept out of diagnostic event JSON), a missing JSON import attribute in Node 26, and browser findings: missing disposition Contact snapshots, subdivision-dependent episode separation, and a reversal fixture whose two presses initially landed on the same authoritative tick. The latter is fixed with an explicit 35ms native-input spacing; server logs retain actual application times. No failure is relabelled as a pass.

Independent review and final validation are recorded after completion. This ticket's checks do not replace the remaining Stage 6 protocol/resource/operating work (#40–#41), or Stage 7 supported-platform, reference-hardware/network, capacity and two-person audiovisual acceptance (#42–#45). No automation run or agent image inspection establishes that wider acceptance. A failed gate blocks progression.

## Review repairs

Independent review found delayed blocked-return clearance, missing browser continuous-position assertions, and raw log storage contrary to the preservation README. Two new literal fixtures first failed for the return defects, then passed in Go/TypeScript after adding swept longitudinal release and relative lateral separation. The 175ms clearance fixture resumes the return for 25ms before 200ms, ending at lateral −30; the sideways-separation fixture resumes immediately at 100ms and reaches lateral −10 at 150ms. Browser checks now apply the same numerical tolerance. Raw logs and routine captures were moved intact into the ignored implementation run folder above; the committed validation index references complete original run folders rather than duplicating them.
