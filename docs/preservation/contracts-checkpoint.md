# #27 generated contracts and Stage 3 exit record

Ticket: [Generate compatible binary contracts and complete-state fixtures](https://github.com/shivang991/DashDevil2D/issues/27). Starting/review baseline: `3c609c91e8c7d883c446d9a71eb4051680bfae48`; branch `codex/dashdevil-multiplayer-integration`. Governing decisions and exact representations are linked in [protocol version 1](../../packages/contracts/protocol/README.md).

| Requirement | Evidence |
| --- | --- |
| Language-neutral mechanical generation for every family | `protocol/schema.json` → TypeScript and Go types/layouts/encode/decode APIs. HTTPS, room, control, inputs, authority/coverage/chunks and verification families. Handwritten validation remains separate. `pnpm check:generated` runs before generation in root check and CI. An intentionally altered generated file was rejected without rewriting it; original restored. |
| Compatible binary values and malformed records | Shared `protocol/fixtures.json` v1, Python/struct independent authoring reference, TypeScript public API tests and native Go tests. Packed lane/control/consumption boundaries, big-endian framing, UTF-8/sections, float64, checked microseconds, versions/counter exhaustion, reserved bits and nonfinite/oversized/truncated records. Literal independently published CRC and seed words retained. |
| Complete continuation, dispositions and barriers | Baseline/Context/Car/Contact/Generator/Window carry immutable configuration, two seats' independent input generations, held/effective controls/deadlines, movement/return timers/origins, normal speed, HP/score/protection, contact/responsibility ordering, generation and stable consumption. Disposition distinguishes accepted/ignored/rejected; barriers/acks carry both cutoffs and authority/event watermarks. Codec fixtures are synthetic state records, not gameplay parity timelines. |
| Atomic transfer and terminal independence | TS/Go public assembly tests with split/reordered chunks; no exposure before complete validation. Reject overlap/duplicates, metadata/context mismatch, allocation overflow and incomplete bytes. Cancel permanently rejects later chunks. Outcome independently encodes full terminal identity, positions/HP/scores/time/watermarks. Application-level finality/replay/barrier ordering awaits session/transport in #28/#29. |
| Exact datagrams/projection/CRC/seed | Exact `12340102030489abcdef` ten-byte vector; 9/11-byte rejection; signed int64 projection bytes and full-state CRC; negative-zero/half-up boundary literals; empty/abc Castagnoli vectors; existing shared track/seed fixtures. Positions remain float64 outside projection. |
| Mandatory exact configuration gate transferred from #25 | Capture invokes actual serialization of complete worst supported continuation for two disjoint maximum-speed windows, full lateral shift/return range, collision extents, generation-ahead/alignment guards and reserved plus random hearts. Native Go independently consumes shared exact resource vectors. Validate real coverage frames, chunk headers/payload/queue bounds, 1 MiB assembled ceiling, signed projection and counter/time widths; reject insufficient limits without truncation or reduced precision. |
| Existing configuration and generated consumers with playable Long Drive | Existing configuration fixtures plus new protocol/resource fixtures; shared contracts are imported through workspace exports by simulation configuration and built into the actual client. No Long Drive gameplay/default/presentation changes are authorized or implemented. Browser preservation is required for this change. Final run results recorded below. |
| Failure retention and actual environment | Logs, source/fixture hashes, decisions and browser run media/manifests retained under `/private/tmp/dashdevil-stage3-evidence/contracts/`. Original red tests, sandbox Go-cache failures and malformed-fixture authoring failure remain through retries. No network impairment/performance acceptance is claimed. |

## Complete Stage 3 checklist

| Stage 3 exit item | Status / evidence |
| --- | --- |
| Target architecture/package ownership | Existing [#24 checkpoint](monorepo-checkpoint.md), plus contract generation ownership/cache outputs and declared workspace consumers. |
| Immutable validated configuration | Existing [#25 checkpoint](configuration-checkpoint.md), now completed with #27 exact serialization/projection resource gate. Full Go configuration semantics belong to Stage 4/#28. |
| Discrete seeded tracks and resize-independent contacts | Existing [#26 checkpoint](track-checkpoint.md), shared seed/track fixtures retained. |
| Generated compatible contracts and complete resource gate | Implementation/targeted tests complete; independent review and final source-frozen checks recorded below. |
| Long Drive applicable automated preservation | Final uncached workspace check and affected actual Chrome scenarios required below. |
| Human audiovisual comparison | **Pending**, as recorded at #26. New automated media does not establish the human comparison. |
| Two-browser real-transport smoke | **Unavailable** until #29 introduces admission/WebSocket/WebTransport endpoints. This prerequisite is not reported as passed. Once introduced it becomes mandatory. |
| Full Go simulation parity | **Unavailable** until #28; existing Go tests cover seeded generation and protocol/configuration resource compatibility only. |
| Supported-release/browser/network/reference-hardware/capacity/manual multiplayer acceptance | Later Stage 4–7 evidence, not established by codec tests or an automation engine. |

**Progression policy:** #27's technical work cannot alone declare the full Stage 3 gate passed. Stage 4 remains blocked until all applicable Stage 3 checks and pending human preservation review pass. Missing later-stage prerequisites are explicitly unavailable, not invented passes. No governing requirement is relaxed.

## Final verification

Pending source-frozen workspace/browser checks and independent Standards/Spec review. Final results will be recorded before ticket closure.
