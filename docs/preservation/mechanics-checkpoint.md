# #28 shared mechanics checkpoint

Issue: [Execute shared multiplayer mechanics through Go authority and TypeScript](https://github.com/shivang991/DashDevil2D/issues/28). Review baseline: `0a384877b9182491d98a22b83f9688abdcf0a76a`.

## Entry approval

The owner confirmed in this implementation chat on 2026-10-15 (America/Phoenix): “Yes I have reviewed long drive. It looks good to me. Approved.” This clears the pending Stage 3 human preservation review recorded at #27. Historical pending evidence remains intact in [the Stage 3 checkpoint](contracts-checkpoint.md).

## Scope and requirement evidence

| Requirement | Implementation / evidence |
| --- | --- |
| Shared multiplayer time, normal movement, NOS and shifts | `packages/simulation/multiplayer.ts` and `apps/server/simulation` implement the same tick-derived boundaries, capped continuous speed integral, immediate NOS and constant-speed adjacent shifts. One mechanics path serves both multiplayer modes. Shared swept geometry and PRNG/cell selection are reused with Long Drive; its easing, acceleration and discrete difficulty remain mode-specific. |
| Authenticated current-round control intents | Adapter supplies authenticated identity independently of the input payload. Validate seat/session/pair/round/input generation, mechanical encoding, increasing contiguous sequence, existing semantic message validation and bounded token-bucket traffic. Next-unprocessed tick applies inputs, preserving per-seat receive order and seat 1 before seat 2. Accepted/ignored/rejected records include copied continuation state; rejected or repeated presses never refresh controls. |
| Freshness and immediate release | Expiry splits the movement interval at its canonical microsecond. Refresh cannot invent/reactivate a press; latest-key release never restores older input. Disconnect clears controls at the current unprocessed boundary and invalidates queued presses. The adapter owns real credential authentication and paired teardown (#29). |
| Configuration semantics | Native Go `configuration.Capture` consumes the same canonical JSON definition and shared configuration fixtures as TypeScript. Private captured groups expose value copies. Existing exact serialization/resource gates remain mandatory. Unknown fields, invalid shapes/types, counts, durations and cross-field relationships reject explicitly. |
| Ordered short-stall catch-up / lag abandonment | Process every elapsed complete tick and every expiry/shift boundary in order; no tick-duration accumulation. Strictly exceeding captured lag threshold abandons at the last processed time without moving ahead. Repeated advancement cannot revise that abandoned state. |
| Seeded multiplayer placement | Common xorshift32 and lane/type selection; generation-v1 chronological reserved/random opportunities, reserved first at equal anchors. Random opportunities start at clear distance + slice spacing, consume two draws even when suppressed; reserved hearts consume one lane draw. Heart anchors are `i/(N+1)*finish`; obstacle exclusion suppresses content without moving hearts. Stable slice identities survive incremental extension/retirement. Independent seeded cursors retain only each car’s reachable placement window; snapshots merge overlapping identities once and do not store the potentially large separation gap. Future interaction slices must add their own mutable consumption state. |
| Independent reference expectations | `packages/contracts/simulation/fixtures.json` v1 contains worked equations and literal expected decisions/times/seed words, consumed by both languages. Continuous fields use `0.000001 + 1e-12 * abs(expected)`; dispositions/events/identity/timing/lanes/PRNG state are exact. Review reports are recorded separately. |
| Applicable browser checks | Existing actual-Chrome Long Drive preservation suite plus a browser diagnostic that loads production headless multiplayer modules, observes NOS-to-steering replacement, draws copied positions and verifies independent sessions. This diagnostic is not transport or timing acceptance. |
| Introduced required checks | Generated-output check, Vitest, native Go tests/vet, TypeScript checks, lint and builds remain required. Results and retained failures recorded in structured validation. |

## Deliberate later-slice boundaries

This is mechanics infrastructure, not a playable multiplayer mode. Player blocking/contacts/returns, road-object consumption/damage, outcomes/deadlines, authoritative transport, prediction reconciliation and multiplayer screens are not claimed by these fixtures. Later gameplay tickets add their own reference scenarios. Existing wire fixtures establish codec compatibility, not gameplay decisions for absent mechanics.

Two-browser real-transport smoke is **unavailable** until #29 supplies HTTPS admission, room WebSocket and WebTransport listeners/certificates. #28 alone does not pass the combined Stage 4 exit gate; #29 must supply actual supported-browser transport evidence before Stage 5. Supported-release matrix, network measurements, reference hardware, capacity and manual multiplayer acceptance remain later gates.

No new Long Drive gameplay correction is authorized by this work. Its only mechanics change is extracting the identical seeded cell-selection operation for reuse; preservation checks must pass.

## Governing decisions

- [Movement/NOS](https://github.com/shivang991/DashDevil2D/issues/4#issuecomment-6119328249)
- [World geometry and tracks](https://github.com/shivang991/DashDevil2D/issues/5#issuecomment-6119616392)
- [Authority, input and time](https://github.com/shivang991/DashDevil2D/issues/11#issuecomment-6124322966)
- [Module ownership](https://github.com/shivang991/DashDevil2D/issues/15#issuecomment-6144509055)
- [Configuration](https://github.com/shivang991/DashDevil2D/issues/16#issuecomment-6146866917)
- [Verification and tolerance](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139)
- [Stage gates](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401)

## Final verification and reviews

Reviewed product revision: `445395276ca7706fed4c178785edf7a40a102269` (clean at final test start). `pnpm check --force --env-mode=loose` passed **257 Vitest tests**, generated-output verification, TypeScript checks, ESLint, native Go vet/tests/build and production builds: **15/15 tasks, zero Turborepo cache reuse**. Native Go tests now use `-count=1`, including shared external fixtures. The final actual-Chrome suite passed **12/12 scenarios with zero retries**, covering all previous Long Drive browser scenarios and the new headless mechanics diagnostic.

Tests used installed pinned Go 1.26.0 via its cached binary path, `GOTOOLCHAIN=local`, and a writable temporary Go build cache. Turborepo's loose environment mode passed those execution-environment settings through; it did not change source validation. Original default-cache and restricted-network toolchain failures remain retained.

[Independent review](mechanics-review.md): Standards **0 outstanding**, Spec **0 outstanding**. The initial semantic-input P2 was fixed and retested red→green in both languages; independent reviewers verified the timeline equations, seed words, literal geometry/placement expectations, schedule invariance and independent-window correction. There are now **17 shared timeline scenarios, six canonical-time vectors, six swept-geometry vectors and two placement scenarios**, plus public API ownership/abuse checks.

[Structured validation](mechanics-validation.json) records versions, hashes, seeds, exact commands, actual environment, logs, retained failures and unavailable prerequisites. Final browser source-frozen manifest and representative screenshots/observations are retained under [evidence/mechanics](evidence/mechanics/browser-final-manifest.json); full videos/traces/audio remain in `apps/client/test-results/run-2026-10-15T07-24-20.343Z-5AsYaj`.

Actual browser: Chrome **155.0.8059.79**; Apple M2/8 GB, Darwin 25.5.0 arm64; Node 26.10.0, pnpm 8.15.9, Go 1.26.0. Viewport 1280×900, Long Drive canvas 606×806, with resized scenarios. Reference-hardware equivalence and power settings remain unestablished. Static agent inspection confirmed the diagnostic canvas and recognizable Long Drive countdown; this does not establish new manual multiplayer or screen-visible performance acceptance.

#28's implemented-mechanics scope is complete. The **combined Stage 4 gate remains incomplete until #29 passes actual supported-browser transport checks**; no later-stage gameplay or acceptance claim is made.

## Supplemental owner browser checks

On 2026-10-15 (America/Phoenix), the owner reported manually testing Long Drive in Safari and Firefox, using the latest available versions of both at the time of testing. The owner confirmed correct behavior with no visual or audio issues in either browser. Exact version numbers, recordings, tested revision and test environment were not captured. This is owner-reported manual Long Drive evidence; it does not establish the complete supported-release matrix or multiplayer transport acceptance.
