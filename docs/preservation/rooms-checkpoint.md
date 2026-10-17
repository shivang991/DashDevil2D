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

Final commands, independent scenario review, revisions, versions, hashes, seeds, environments, logs and visual inspection will be recorded after source review.
