# #30 private rooms and countdown checkpoint

Issue: [Create and join private rooms, ready and count down](https://github.com/shivang991/DashDevil2D/issues/30). Implementation baseline: `ef3f0d8` on the current `main` branch.

## Entry and scope

On 2026-10-16 (America/Phoenix), the owner confirmed in this implementation chat: **“stage 4 verification is completed.”** This is the entry authorization for #30. The historical incomplete gate statements in the transport/mechanics checkpoints are retained; this later owner confirmation supersedes their entry-blocking status. No missing historical browser/certificate artifact is invented or retroactively reported as an automated pass.

The owner agreed to two TDD seams: authenticated room commands through actual paired TLS/WebSocket/WebTransport connections, and the React UI in two actual browser contexts. Initial failures and every retry are retained in `/private/tmp/dash30-logs` and the browser harness's separate timestamped evidence directories.

This slice ends at a synchronized authoritative round zero. Driving, prediction, impacts and results are later tickets starting with #31; no complete playable Stage 5 path or full multiplayer acceptance is claimed. Long Drive remains playable through its existing GameSession.

## Governing decisions and evidence map

| Requirement | Implementation and validation |
| --- | --- |
| Four-digit codes, duplicate immutable local names, tab credentials and admission errors | `localName.ts`, native React entry form, existing opaque HTTPS admission. Two Chrome contexts use identical names and show You; native form submits literal `0042` bytes; denied local storage retains one page-session name. Existing Stage 4 tests retain authentication and replacement coverage. |
| Host mode/Start, readiness and pending confirmation | Serialized room command owner, sequenced `RoomReply`, React lobby. Native real-transport mode/readiness/rejection scenarios; two-browser host mode change clears both readiness flags. |
| Paired initialization and fresh round installation | Both channels plus baseline acknowledgement establish connected eligibility. Start creates one room-owned zero baseline from Go mechanics and canonical config/seed; a fresh reliable initialization/transfer for both peers must be acknowledged before entering active phase. No cross-channel arrival order is assumed; early chunks have a bounded queue. |
| Exact shared start, three-second countdown without physics | Server monotonic StartUs, clock exchanges and shared room/round identity. Countdown never invokes AdvanceTo. Browser evidence compares exact start/round/zero cars and discarded ArrowUp presses. `RoomPulse` supplies application liveness independently of gameplay ticks. |
| Cancellation, focus and explicit Leave | Hidden-tab focus command, paired loss and explicit leave cancel countdown and clear readiness. Blur alone clears readiness without expanding the hidden-only cancellation rule. The deadline checks paired installation/connectivity. Native disconnect cancellation; browser visibility fixture cancellation and fresh readiness; confirmed leave cancels and transfers host. |
| Recovery and preservation | Replacement reason prevents superseded auto-recovery loops; reload restores the authenticated seat with a new pair generation and fresh input generation. Existing diagnostic mode remains explicit and separately exercised. Existing Long Drive browser scenarios remain mandatory. |
| Shared fixtures and generated output | Literal independently authored big-endian RoomReply/RoomPulse/focus-command vectors are consumed by existing Go and Vitest checks. Canonical config JSON is included in generated Go output and checked for staleness. |

Sources: [lifecycle](https://github.com/shivang991/DashDevil2D/issues/8#issuecomment-6120278462), [protocol](https://github.com/shivang991/DashDevil2D/issues/14#issuecomment-6142660562), [screen/focus](https://github.com/shivang991/DashDevil2D/issues/19#issuecomment-6147750725), [verification](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139), [sequence](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401).

## Evidence limits

The visibility browser scenario uses an explicitly labelled platform-event fixture; it does not establish real OS background scheduling. Browser automation uses installed actual Chrome and process-scoped local HTTPS/SPKI and WebTransport certificate pins. Current/previous release, OS trust stores, physical background/focus behavior, network impairments, reference-hardware performance, capacity, and two-person manual multiplayer acceptance are not newly established by this run. Owner-reported completed Stage 4 verification is separate from this slice's automated evidence. No Long Drive defect correction is authorized or introduced.

## Final verification

Final clean source revision: `ff695beeff95297ff6d9fedb9cfe7c726d73d6f8`. The full workspace check passed **15/15 tasks, zero cache reuse**, including generated-output verification, types, lint, **261 Vitest tests**, native Go tests/vet and production builds. After the small final notice/copy change, complete client typecheck/lint/Vitest/build passed again. The native room cases also passed the Go race detector. Exact tested revisions per command are retained in [structured validation](rooms-validation.json).

Final actual Chrome **155.0.8059.80**, Node **26.10.0**, pnpm **8.15.9**, Go **1.26.0**, Apple M2/macOS arm64 (Darwin 25.5.0):

- **5/5 secure room browser scenarios**, zero retries: two-seat exact shared zero and hidden-event cancellation/re-readiness; literal leading-zero binary admission; denied-storage name fallback; host mode reset/reload recovery/leave confirmation; delayed command reply with unrelated room broadcasts.
- **3/3 retained transport browser scenarios**, zero retries: real streams/datagrams/baseline correction, same-seat paired loss/recovery/replacement, unsupported-browser and network-failure distinction.
- **12/12 existing Long Drive/mechanics browser scenarios**, zero retries in the final source-frozen run, including optional-audio failure, countdown/pause/focus/input, score/HP/resize and actual presentation/audio recording. No Long Drive gameplay code was changed.

[Independent two-axis review](rooms-review.md) has **0 outstanding Standards and 0 outstanding Spec findings**. The P2 pending-confirmation defect was reproduced red through an intercepted real server reply, fixed, and verified green. Literal wire vectors and round-zero expectations were independently checked.

[Retained evidence](evidence/rooms/rooms-manifest.json) includes clean source revisions, runtime/config/fixture versions, hashes, seeds, per-seat identities/state, screenshots and logs. The agent visually inspected the lobby, a correctly synchronized large `3` countdown, and both participants' shared-zero screen. This is agent visual inspection, not a new two-person human acceptance claim.

All original failures remain: initial native red/path/sandbox failures, stale root-owned build/cache artifacts, the diagnostic URL interception regression, the pending-confirmation review regression, and the original Long Drive audio-unavailable run. That preservation failure included unexpected navigation back to the menu and a second Vite connection; its cause was not established. The unchanged full frozen suite then passed. Its original [failure manifest](evidence/rooms/preservation-original-failure-manifest.json), screenshot/error context and all command logs are retained alongside subsequent passing evidence; full original trace/video remain in the timestamped test-results directory. No assertion was relaxed or scenario excluded to obtain the passing preservation run.

#30's rooms/readiness/countdown/authoritative-zero scope is complete. The full playable Stage 5 path continues in #31 and subsequent tickets; full multiplayer/browser/network/manual acceptance remains outside this slice.
