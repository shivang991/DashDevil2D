## Resolution — confirmed with the project owner

The owner confirmed this complete agreement and its final clarifications in the live wayfinder discussion and authorized recording it, closing this decision, and updating the map and transport supersession pointer. Planning only: no encoder, product code, tests, deployment, or implementation tickets.

## Final agreement and superseded choices

- WebTransport remains the exclusive gameplay transport; HTTPS admission and room WebSockets retain their settled responsibilities. Retain the three reliable streams: bidirectional gameplay control, client-to-server inputs, and server-to-client authority.
- Amend [Choose the supported gameplay transport](https://github.com/shivang991/DashDevil2D/issues/13): add server-to-client verification datagrams. Its earlier exclusion of datagrams is superseded by this decision; no gameplay fallback is introduced.
- Drop periodic full checkpoints and their proposed datagram fragmentation. Periodic traffic verifies predicted state; reliable records convey relevant authoritative changes. Complete baselines are sent reliably for initialization, correction and recovery only.
- Initial datagram application payloads are exactly 10 bytes, including our fields. QUIC/UDP/IP overhead is outside this cap and inside the measured network budget. Raising this starting cap requires an explicit protocol review.
- Custom binary encoding and bit packing replace the initially proposed JSON format. Position precision in simulation and reliable baselines remains float64.

## Communication and message families

| Channel | Messages and required information |
| --- | --- |
| HTTPS | Create/join/resume seat; issue room-seat credential and paired channel admission tickets; explicit admission/version errors. |
| Room WebSocket | Version/seat/generation initialization, authoritative room state and lifecycle revisions, selected mode, readiness, countdown schedule/cancellation, host changes, departures, reservation deadlines, idle warning and expiry. Commands are versioned, sequenced, and applied only to the authenticated current seat/generation. No gameplay fallback. |
| Reliable gameplay control | Handshake/version acceptance, initialization and baseline acknowledgements, clock request/reply, correction/recovery coordination, authority-progress acknowledgements, explicit errors, and self-contained final outcomes. |
| Reliable player inputs | Ordered fresh presses, releases and held-control freshness refreshes, with input sequence and current round/input-generation identity. |
| Reliable authority | Input disposition/application records, authoritative gameplay events, verification barriers, and bounded complete-baseline transfers. |
| Gameplay datagrams | Epoch, authoritative tick and CRC32C verification fingerprint only. |

Room and gameplay messages do not assume cross-channel arrival order. Initialization, round start and recovery use explicit readiness/barrier acknowledgements. Room revisions do not authorize gameplay before its matching initialization is complete. A finalized gameplay outcome is authoritative regardless of room-state arrival order.

## Identity, framing and compatibility

- Connections are bound by admission to an internal room identity and seat. The reusable four-digit code and display name are not identities or authorization.
- Distinguish the room-seat session, paired connection generation, round identity, input generation, verification epoch, per-seat input sequence and authoritative record/event identity. A fresh round never reuses an old round identity within a room session. Old-pair messages or teardown cannot affect a replacement.
- Use exact protocol-version agreement in the reliable handshake. No implicit wire downgrade, ignored new fields, or alternative gameplay transport.
- Reliable binary frames have an unsigned 32-bit big-endian body length followed by a message-type discriminator and the version's defined payload. Bound the advertised length before allocation. The version's schema must fix every field's width, order, enum values, bit allocation and permitted optional sections; unknown types and nonzero reserved bits are errors. One stream can contain partial or multiple frames; transport read boundaries are not message boundaries.
- Use unsigned 16-bit verification epochs, unsigned 32-bit ticks and sequence counters, unsigned 32-bit seed/state words, integer-microsecond timestamps and IEEE-754 float64 positions. Timestamp wire fields use unsigned 64-bit integers, accepted only within JavaScript's exact integer range. Reject counter wrap rather than interpreting wrapped traffic as fresh; renew before epoch exhaustion and validate round durations before tick exhaustion.
- Bounded strings use UTF-8; variable-length sections have explicit bounded lengths/counts. Packed flags and bounded enums have one canonical representation; unused bits must be zero. Signed quantized values have a specified signed integer representation shared by both implementations.
- Bit packing applies to controls, lanes, movement phases, contact/consumption flags and bounded values. Do not silently quantize baseline/correction positions or change simulation equations.
- Shared byte fixtures must precede interoperability acceptance. Concrete message-type numbers and full byte-offset tables are protocol-schema implementation artifacts governed by this contract, not permission to change its semantics or limits.

## Inputs, acknowledgements and authoritative events

- Send press/release edges immediately. Every input-stream message, including freshness refreshes, has an increasing per-seat input sequence and round/input-generation context. Preserve control order within a seat; the settled Player 1-before-Player 2 rule applies at equal authoritative application times.
- A freshness refresh reports held control state and its input progress without inventing a new press. Its default interval is 250 ms, configurable. It cannot reactivate a control after expiry or bypass steering/NOS/return restrictions; fresh permitted input is required. Focus loss clears controls; disconnection releases them immediately. The settled configurable one-second freshness expiry remains authoritative.
- Input disposition distinguishes accepted, ignored and rejected. Accepted control changes carry authoritative application tick/time and resulting effective control changes; freshness extension/expiry is represented sufficiently to reconstruct effective state. Ignored presses do not enter Road Rage input history. Client timestamps never backdate acceptance.
- Acknowledgements identify the highest contiguous processed input sequence, with individual dispositions for input edges whose acceptance/ignore/rejection changes replay. Transport delivery acknowledgements do not substitute for simulation disposition.
- Duplicates never apply twice or refresh control freshness. Stale-round/generation inputs never affect the current round; acknowledge or discard according to their known disposition, without treating them as fresh input. Invalid control intents cannot assert positions, HP, damage or outcomes.
- Authority records have monotonically ordered identities and application tick/canonical microsecond time. Input, pickup/healing, eligible damage and terminal precedence remain as settled. Include resulting authoritative values/state transitions and stable causal/object/contact identities needed to repair prediction and suppress repeated effects.
- Relevant event records cover pickup consumption, per-player obstacle consumption, HP/score/protection changes, contact/return/blocking transitions, held-control expiry/release, and round events. Client replay must not duplicate state already represented by a baseline or already-confirmed event.
- Display lightweight provisional feedback once; confirmation reconciles it rather than repeating it. Preserve confirmed events and server-only final outcomes.

## Complete reliable baselines and track coverage

- A complete baseline identifies its round, paired connection generation, verification epoch, authoritative tick/time, authority watermark and processed/disposed input progress for both seats. It is an atomic coherent state, not a mixture of states from different ticks.
- Initialization supplies the immutable round configuration, world geometry, tick rate, generation version, nonzero seed and announced round-start clock. Recovery repeats or verifies immutable context so a client cannot restore against a mismatched configuration.
- Mutable state includes both cars' float64 positions; held/effective controls and freshness deadlines; NOS; lane-shift/return departure, target and timing state; HP, scores and protection timers; player-contact episode and tailgating/blocking state; latest qualifying Road Rage input and authoritative ordering information; track-generation cursor/state and coverage; and mutable object state in the represented track windows. Preserve all hidden state needed for deterministic continuation, not merely visible values.
- Track windows cover both cars and their permitted prediction horizon, including collision extents and generation ahead. Immutable placement regenerates from seed/configuration; mutable pickup consumption and per-player obstacle consumption are complete within the covered windows and ordered by stable object identity. Windows need not include the empty distance between widely separated cars.
- Retire state only after the settled track rules allow it. Window changes must establish authoritative mutable state before prediction uses newly covered objects. If movement would leave known coverage, stop speculation and request fresh state; never assume an object is unconsumed. Validate coverage against maximum permitted speed, collision bounds and the prediction horizon in the configuration contract.
- Transfer baselines in bounded reliable chunks with transfer identity, tick/watermarks, total length and chunk offset/count. Reject overlapping/inconsistent/incomplete transfers; atomically install only a complete validated baseline. A terminal result can supersede an unfinished transfer.
- Baseline transfer uses the authority stream, keeping control-stream outcomes and recovery coordination independent. Essential ordered records cannot be silently omitted. Chunk scheduling respects queue/drain limits.

## Verification datagrams and canonical fingerprint

Exactly one record per server-to-client datagram; no fragmentation and no retransmission:

| Offset | Field | Width |
| --- | --- | --- |
| 0 | Verification epoch, big-endian | 2 bytes |
| 2 | Authoritative tick, big-endian | 4 bytes |
| 6 | CRC32C fingerprint, big-endian | 4 bytes |

- Default generation interval is 100 ms and is adjustable. It is independent of the 60 Hz simulation. Configuration must preserve established freshness/recovery/visual targets; adjustable does not mean acceptance requirements are relaxed.
- No version/type byte is needed inside this record: the reliable handshake establishes the only permitted datagram schema and direction. A wrong length is unusable and is discarded. Verify the current connection supports at least a 10-byte outgoing datagram payload; inability to support the required channel is an explicit connection failure.
- Establish a fresh verification epoch on each installed baseline, with an acknowledgement barrier before comparing or emitting applicable verification. Ignore wrong-epoch and older ticks; do not buffer datagrams for an unknown future epoch. Never reuse an epoch on the same connection; renew before its unsigned 16-bit counter wraps.
- Each verification tick has a reliable authority barrier identifying the authority/input/event progress included in that tick. Send immediately relevant input/events, not just at the barrier. A datagram arriving first waits for its barrier and preceding records. A newer received barrier can establish coverage for earlier retained ticks. Missing history triggers recovery.
- Compare reconstructed state at the same authoritative tick, using accepted input times and excluding unresolved local prediction. Do not compare old fingerprints to current rendered positions. Preserve unresolved inputs separately for normal prediction/replay.
- The canonical verification projection covers the same continuation-relevant mutable state represented by the baseline, its current track windows, generation/configuration identity and applicable input/event watermarks. Fix field order, Player 1 then Player 2, and object order by stable identity in shared schema fixtures. Exclude presentation offsets, client clock-estimate noise and provisional inputs.
- Quantize world positions for this projection only: `floor(value * 1024 + 0.5)`, interpreted as signed quantized world units; normalize negative zero to zero. Encode discrete state and canonical event times exactly. Reject nonfinite values or projection overflow. Simulation and reliable baseline positions remain float64.
- CRC32C uses the Castagnoli polynomial: normal `0x1EDC6F41`, reflected `0x82F63B78`, initial register and final XOR `0xFFFFFFFF`, reflected processing. Go reference: `crc32.Checksum(bytes, crc32.MakeTable(crc32.Castagnoli))`. Required vectors include empty bytes → `0x00000000`, UTF-8 `abc` → `0x364B3FB7`, plus state-projection fixtures. [Go CRC source](https://go.dev/src/hash/crc32/crc32.go), [reference tests](https://go.dev/src/hash/crc32/crc32_test.go).
- Equality is a compact drift diagnostic, not proof of identical state or anti-cheat. CRC collisions and quantization can hide differences; arbitrarily close positions can straddle a quantization boundary and cause a mismatch. Reliable events and server outcomes remain authoritative. A mismatch requests a reliable baseline rather than inferring which field differs.
- Replace only the newest unsent verification record. Loss/reordering needs no retransmission; the next usable record suffices. Wrong-epoch, malformed or obsolete datagrams do not refresh liveness.
- WebTransport datagrams are unreliable/unordered and QUIC does not fragment them automatically. Our 10-byte verification record avoids the earlier full-checkpoint fragmentation design. [WebTransport](https://www.w3.org/TR/webtransport/), [RFC 9221](https://www.rfc-editor.org/rfc/rfc9221.html#section-5).

## Correction, replay and recovery

- A genuine verification mismatch requests one complete current reliable baseline. One request may be outstanding; coalesce additional mismatches until it completes. Start a fresh verification epoch on installation.
- Default retained replay history is two seconds, configurable. Histories and pending-input buffers remain bounded by the traffic limits; missing history or unsafe reconstruction chooses recovery rather than guesswork.
- Ordinary correction preserves unresolved current-round inputs not represented by the baseline's processed-input cutoff, including inputs still in transit. The cutoff is an input-sequence watermark, not wall-clock send time. Replay those inputs provisionally, adjusting or removing them when their authoritative dispositions arrive. Never double-apply inputs already represented by the baseline.
- Suspension, stale-period recovery, reconnect or unreliable history discards stale pending prediction and resumes with fresh controls. Establish a fresh input generation for this reset so delayed old-generation inputs cannot reactivate controls across streams. Server control release/reset and the new baseline/ready barrier are authoritative; an ordinary drift correction does not unnecessarily reset valid held controls.
- Reliable authority acknowledgements identify applied/retained contiguous progress. This makes essential-progress timeouts application-level, rather than assuming a successful stream write means the client processed it.
- After one second without usable authoritative updates, show the settled warning and freeze further speculation; the server continues. Valid applicable barriers/events provide authoritative progress; partial transfers, invalid records and inapplicable datagrams do not pretend to restore usable state.
- Recovery restores current state within the existing one-second p95 normal-condition target after successful connection restoration. Connection-pair recovery remains strictly before the configurable 15-second grace deadline. No stale-input replay or gameplay fallback.
- Correct predicted state immediately, then apply the previously settled presentation smoothing/snap rules. HP/object/control restrictions are discrete corrections. This decision does not relax abrupt-correction or settling acceptance targets.

## Round outcomes and cross-stream finality

- Reliable control-stream final outcomes are self-contained: round and unique outcome identity, terminal tick/microsecond time, result and reason, final player positions/HP/scores and authority watermarks.
- Apply a valid outcome immediately and idempotently, even before older authority records or an unfinished baseline transfer arrive. Stop gameplay advancement and use the settled confirmed-result presentation.
- Older records cannot resume gameplay, overwrite terminal state, repeat confirmed effects or change a final result. A recovered participant receives the already-finalized result. Rematches require fresh round context/readiness and reset state while reusing initialized transport connections.

## Clock synchronization

- Exchange client-send, server-receive, server-send and client-receive monotonic timestamps, initially and then every one second by configurable default.
- Use low-round-trip samples from the latest eight valid exchanges and adjust the estimate gradually. Reject invalid/out-of-order exchanges and negative derived round-trip durations. Timestamp units are integer microseconds with checked exact-integer conversion in TypeScript.
- Clock estimates support current-time prediction and diagnostics, never authoritative backdating. Round zero remains the announced server start instant; countdown is excluded. Tick boundaries derive from tick number and configured rate; event-time rounding and precedence remain unchanged.

## Admission, replacement and errors

- Use random opaque 256-bit room-seat credentials, retained in tab session storage and valid only while that seat/session is valid. Neither immutable local names nor room codes authorize recovery.
- HTTPS exchanges the room-seat credential for 30-second, single-use admission tickets bound to internal room identity, seat, paired connection generation, channel type and allowed origin. Issue separate tickets for the room WebSocket and gameplay WebTransport of the same pair. Expired/consumed tickets do not invalidate a still-valid room-seat credential; issue fresh tickets for recovery.
- A valid replacement pair supersedes the old generation. Complete both channel admissions and gameplay initialization before marking the participant connected/ready; recovery completion remains strictly before its grace deadline. Old-pair traffic and close callbacks cannot mutate the replacement.
- Invalidate room-seat credentials when the seat or room ends; explicit leave skips recovery. Preserve paired loss/teardown, host transfer, forfeit/abandonment and terminal precedence.
- Reject incompatible versions and admission failures explicitly; no transport fallback. Preserve Browser unsupported versus Unable to connect distinctions from the transport decision.
- Malformed reliable frames, invalid lengths/enums/reserved bits/nonfinite numbers and values outside allowed ranges fail the connection explicitly. Stale/duplicate traffic has no gameplay effect. Unusable datagrams are discarded and cannot refresh liveness. Rate abuse and essential backlog enter paired connection failure/recovery rather than silently dropping ordered inputs/events.

## Bounds and measured bandwidth

All starting defaults are configurable where agreed, with units and cross-field validation owned by [Define configurable gameplay and validation](https://github.com/shivang991/DashDevil2D/issues/16):

| Limit | Starting value |
| --- | --- |
| Datagram application payload | Exactly 10 bytes; cap increase requires review |
| Verification interval | 100 ms |
| Held-control refresh interval | 250 ms |
| Clock synchronization interval | 1 second; latest 8 valid exchanges |
| Replay retention | 2 seconds |
| Reliable frame | 64 KiB maximum |
| Complete assembled baseline | 1 MiB maximum |
| Outgoing queue | 256 KiB or 512 messages, whichever comes first |
| Essential application-queue wait | 500 ms maximum |
| Essential unacknowledged progress | 1 second maximum while essential records are outstanding |
| Input traffic per seat | 60 messages/second; burst 120, including refreshes |
| Clock requests per seat | 2/second |
| Recovery requests per seat | 1/second, at most one outstanding |
| Admission ticket | 30 seconds; single use |
| Ordinary network budget | 16 KiB/second/direction/player, averaged over 60 seconds |

- Do not queue an entire large transfer beyond queue bounds; produce reliable chunks as the queue drains and enforce the total assembled baseline limit. Required state exceeding this limit is a configuration/protocol failure, not permission to truncate it.
- Never silently drop essential ordered input/events. Close the pair on queue overflow, excessive application-queue wait, rate violation or no acknowledged essential progress for one second. The progress deadline applies when essential traffic is outstanding, not to an idle connection with nothing awaiting acknowledgement.
- Prevent backlog from hiding in transport writes; bound in-flight work and observe application acknowledgements. Cannot retract bytes already written. The operating/verification decisions must measure drain behavior rather than treating writable acceptance as end-to-end freshness.
- Heartbeat/barrier traffic must keep the existing active-play freshness contract measurable even when no gameplay event occurs. Its bytes count in the budget.
- Measure actual network bytes including QUIC/UDP/IP overhead, reliable barriers, refreshes, input/events and ordinary corrections. Initialization/recovery bursts are reported separately, including their sizes and frequency; do not conceal frequent ordinary drift corrections as recovery bursts.
- Datagrams alone contribute 100 application bytes/second/client at the 100 ms default, but that is not the total network cost. Packet overhead and reliable records must be measured.
- Exceeding the ordinary budget fails acceptance and triggers protocol/configuration review. It does not authorize dropping essential records, weakening accepted gameplay targets or automatically increasing the 10-byte cap.

## Go/TypeScript seeded compatibility and acceptance

- Preserve the settled xorshift32 algorithm and unsigned 32-bit seed/state representation. Both implementations must share exact shift parameters, advance-before-return behavior, nonzero seed policy, draw order and track-generation version/configuration.
- Confirmed compatibility definition: unsigned xorshift32 (13,17,5), nonzero seed in 1…4,294,967,295. Seed 1 yields `00042021`, `04080601`, `9dcca8c5`, `1255994f`, `8ef917d1`. This fills the previously unspecified seed/algorithm compatibility detail without changing the already selected PRNG family. [Marsaglia, Xorshift RNGs](https://www.jstatsoft.org/article/view/v008i14). Vectors were also independently calculated during fact exploration.
- Shared fixtures cover every message family and packed-bit boundary, signed quantization/negative zero, CRC projection and vectors, big-endian values, float64 corrections, exact timestamps, seed/track vectors, same-time input ordering, input dispositions/freshness expiry, pending-input replay, track-window expansion/consumption, baseline transfer limits, malformed frames and version mismatches.
- Exercise datagram loss/reordering, datagram-before-barrier delivery, epoch supersession, partial baseline transfer, late outcomes/authority records, pair replacement, tab suspension, input reset across streams, stalled readers, queue limits and admission/grace boundaries.
- All existing normal/degraded network envelopes, browser requirements, responsiveness/correction/result/recovery targets and 50-room/100-player 30-minute capacity requirements remain in force. A compact schema is not evidence these targets have passed.

## Existing decision ownership and map maintenance

- [Choose the supported gameplay transport](https://github.com/shivang991/DashDevil2D/issues/13): append a linked supersession pointer for verification datagrams; retain the other transport/lifecycle decisions.
- [Choose module and monorepo boundaries](https://github.com/shivang991/DashDevil2D/issues/15): ownership of protocol schema/codec, prediction/replay, authoritative state, paired lifecycle and admission.
- [Define configurable gameplay and validation](https://github.com/shivang991/DashDevil2D/issues/16): validate interval/expiry/history/queue limits, track coverage and baseline bounds while preserving accepted timing targets.
- [Define the behavior and integration verification contract](https://github.com/shivang991/DashDevil2D/issues/17): shared wire/seed fixtures and complete acceptance matrix above.
- [Define the initial server operating model](https://github.com/shivang991/DashDevil2D/issues/18): actual versions/interoperability, queue/ack instrumentation, endpoint/origin/credential handling and measured network budget/capacity.
- [Define the multiplayer screen and input-focus behavior](https://github.com/shivang991/DashDevil2D/issues/19): explicit protocol/admission errors, warnings, fresh-control recovery and authoritative result presentation.
- No new independent ticket is identified. Existing cross-mode reuse/migration fog remains unchanged. No new game-domain glossary term is required: protocol mechanics belong in this resolution, not the domain glossary.
