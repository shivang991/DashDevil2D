# #27 generated contracts and Stage 3 exit record

Ticket: [Generate compatible binary contracts and complete-state fixtures](https://github.com/shivang991/DashDevil2D/issues/27). Starting/review baseline: `3c609c91e8c7d883c446d9a71eb4051680bfae48`; branch `codex/dashdevil-multiplayer-integration`. Governing decisions and exact representations are linked in [protocol version 1](../../packages/contracts/protocol/README.md).

| Requirement | Evidence |
| --- | --- |
| Language-neutral mechanical generation for every family | `protocol/schema.json` → TypeScript and Go types/layouts/encode/decode APIs. HTTPS, room, control, inputs, authority/coverage/chunks and verification families. Handwritten validation remains separate. `pnpm check:generated` runs before generation in root check and CI. An intentionally altered generated file was rejected without rewriting it; original restored. |
| Compatible binary values and malformed records | Shared `protocol/fixtures.json` v1, independent Python/struct authoring calculations (script subsequently removed), TypeScript public API tests and native Go tests. Packed lane/control/consumption boundaries, big-endian framing, UTF-8/sections, float64, checked microseconds, versions/counter exhaustion, reserved bits and nonfinite/oversized/truncated records. Literal independently published CRC and seed words retained. |
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
| Generated compatible contracts and complete resource gate | Passed technical checks and independent review; final source-frozen evidence below. |
| Long Drive applicable automated preservation | Passed: 218 Vitest checks, native Go suites, generation verification/types/lint/builds, and all 11 actual Chrome scenarios. |
| Human audiovisual comparison | **Passed by owner review on 2026-10-15 (America/Phoenix)**: “Yes I have reviewed long drive. It looks good to me. Approved.” Approval supplied in the #28 implementation chat; automated media alone did not establish this review. |
| Two-browser real-transport smoke | **Unavailable** until #29 introduces admission/WebSocket/WebTransport endpoints. This prerequisite is not reported as passed. Once introduced it becomes mandatory. |
| Full Go simulation parity | **Unavailable** until #28; existing Go tests cover seeded generation and protocol/configuration resource compatibility only. |
| Supported-release/browser/network/reference-hardware/capacity/manual multiplayer acceptance | Later Stage 4–7 evidence, not established by codec tests or an automation engine. |

**Progression policy:** #27's technical work cannot alone declare the full Stage 3 gate passed. Stage 4 remains blocked until all applicable Stage 3 checks and pending human preservation review pass. Missing later-stage prerequisites are explicitly unavailable, not invented passes. No governing requirement is relaxed.

## Final verification

Reviewed product source: `976c69db34242e6617247ab8f91a22281d7af84a` (clean worktree). `pnpm check --force` passed **218 Vitest checks**, generated-output verification, typechecking, lint, native Go tests/vet/build and production builds: **15/15 tasks**, zero Turborepo cache reuse. A supplementary native `go test -count=1 ./...` passed both protocol and track suites without test-result caching. Final actual Chrome run passed **11/11 scenarios, zero retries**, with preserved complete manifests/media/audio/traces.

Final browser manifest: `apps/client/test-results/run-2026-10-15T00-15-14.062Z-xxdtyE/manifest.json`. Actual browser Chrome **155.0.8059.79**, Apple M2/8 GB, Darwin 25.5.0 arm64; Node 26.10.0, pnpm 8.15.9, Go 1.26.0. Viewport 1280×900, canvas 606×806; resized and high-speed scenarios retained. Native shell reports macOS 26.5.2; the browser harness reports its recorded Darwin release. Reference-machine equivalence/power settings remain unestablished.

[Independent review](contracts-review.md): Standards **0 outstanding**, Spec **0 outstanding**, after fixing leading-BOM UTF-8 compatibility and invalid movement continuation. Both fixes have shared regression fixtures and retained original red runs. The reviewer independently checked packed bytes, exact datagrams, projection CRC, resource envelope/counts and invalid scenario expectations. Full [structured validation](contracts-validation.json) records revisions, hashes, versions, seeds, environment, logs, original failures and limitations.

Literal exact default resource envelopes: Drag Race **16 objects / 1,278 baseline bytes / 1,358 chunk-frame bytes / 438 coverage-frame bytes**; Road Rage **12 / 1,210 / 1,290 / 370**. Dense enabled random hearts and high-speed/wide-car scenarios have independent shared sizing vectors. Byte totals include complete fixed continuation and immutable context; no consumption-only approximation is used to approve capture.

Agent inspected final countdown and resized pause snapshots. This is static inspection, not owner audiovisual signoff. New human comparison remains pending; **the full Stage 3 gate is not declared passed and Stage 4 remains blocked on that review**. Real transport and full Go gameplay parity remain unavailable until #29/#28. No later-stage network/browser/capacity acceptance is claimed.

Subsequent owner-requested cleanup removed the one-off fixture authoring script and `.scratch/dashdevil-multiplayer/` planning snapshots. The canonical planning decisions remain in the linked GitHub issues. The structured validation record retains the original script hash as historical evidence of tested revision `976c69d`; it does not assert the script remains in the current checkout. Shared fixtures, schema, codecs and verification checks are retained.

## Stage 4 entry cleared by owner

On 2026-10-15 (America/Phoenix), in the #28 implementation chat, the owner confirmed: “Yes I have reviewed long drive. It looks good to me. Approved.” This supplies the previously pending human Long Drive preservation review and clears the recorded Stage 3 entry blocker for #28. Historical pending statements above describe the #27 completion state; they are retained as evidence. This approval does not establish later multiplayer or transport acceptance.
