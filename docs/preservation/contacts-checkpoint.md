# #33 Drag Race car contacts

Issue: [Overtake, return from impacts and tailgate in Drag Race](https://github.com/shivang991/DashDevil2D/issues/33). Starting revision: `ed23fe4`. Date: 2026-10-16 America/Phoenix. The owner confirmed shared public Go/TypeScript simulation APIs and the existing two-browser real-transport harness as test seams. Contact fixture version 1; protocol/configuration/generation versions remain 1.

## Governing decisions

[Movement/NOS](https://github.com/shivang991/DashDevil2D/issues/4#issuecomment-6119328249), [world geometry](https://github.com/shivang991/DashDevil2D/issues/5#issuecomment-6119616392), [event precedence](https://github.com/shivang991/DashDevil2D/issues/7#issuecomment-6120100711), [prediction](https://github.com/shivang991/DashDevil2D/issues/12#issuecomment-6124581405), [verification](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139), [stage gates](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401).

## Requirements and evidence

| Requirement | Implementation / evidence |
| --- | --- |
| Swept car geometry, touching/separating, no tunneling | Both engines intersect lateral movement intervals with integrated relative forward motion. Player contact splits the same chronological loop used for objects and finishes. `packages/contracts/race/contacts.json` contains literal shared expectations, including a 20× NOS sweep, speed growth, and a forward impact exactly at a tick boundary. Position tolerance is absolute 1e-6 plus relative 1e-12; phase, effective input and canonical event times match exactly. |
| Single/dual shifts, existing returns | Only cars in shift phase start a return. Departure lanes are retained, returns start at contact positions, and existing return origins/timers are never replaced. Shared fixtures include dual return completion and a new shifting impact against an existing return. |
| NOS/fresh input | A return clears effective and held controls. Presses during return and refreshes after completion cannot reactivate NOS. Public-API regressions in TypeScript and Go require a fresh press after completion. |
| Tailgating and overtaking | Geometric rear contact clamps actual forward movement to the leader's requested motion while retaining the follower's requested NOS. The same constrained motion drives object and finish checks. Starting shifts is barred until positive longitudinal gap or sideways clearance. The loop splits at sideways clearance within a tick. Shared fixtures cover persistent equal-speed lock, faster leader separation, boosted follower release and passing in another lane. |
| Objects and HP | Contact adds no player HP damage. Existing object-return, simultaneous-healing/damage and consumption fixtures remain mandatory. Road objects retain strict overlap semantics; player rectangles block at touching edges. |
| Authority/prediction/rendering | Go emits both cars in reliable contact events using the existing protocol. TypeScript prediction uses the same simulation; rendering still receives copied positions and cannot alter geometry. Existing CRC/repair and rendering/session checks remain required. |
| Real transport | New `pnpm test:contacts` runs two independent installed-Chrome contexts over actual HTTPS/WebSocket/WebTransport with swapped leader seats: dual returns, NOS overtaking, persistent rear contact, lane-change lock, sideways release, intact HP and matching authoritative finish. The labelled `infra/contacts-track.json` clears objects and uses 4800 finish units; shipped defaults do not change. Screenshots, per-seat samples, actual environment, context, identities and seed are attached. CI now requires this suite. |
| Preservation / authorized changed expectations | Long Drive code and retained preservation scenarios are unchanged. The existing multiplayer free-steering test now places its opponent 200 units ahead, avoiding the newly forbidden pass-through. The earlier heart browser setup tried to park both players at identical progress in one lane. It now uses one legal full-health collector and verifies shared consumption/denial in both browsers. Exact contested-pickup shared unit fixtures remain. These are consequences of the explicitly required blocking behavior, not Long Drive corrections. |

## Failure retention

Original failing expectations, harness restrictions and retries remain in ignored `apps/client/test-results/contacts-implementation/logs/` and the original transport run folders. Initial TS and Go follower tests both observed progress 160 instead of 100. `apps/client/test-results/contacts-implementation/logs/boundary-red.log` records a missed return exactly at a tick boundary; the fix tests requested closing motion before a shifting follower's movement is clamped. Initial type/Go checks encountered restricted access to the default Go cache; later checks use an isolated temporary cache. The first full check records a free-steering fixture passing through the opponent and native transport tests denied local listeners by the sandbox. The final full check uses authorized local listeners. No failed attempt is counted as a pass.

## Gate scope

This is #33's Stage 5 contact slice, not Stage 5 exit or full multiplayer acceptance. Later correction/lifecycle work, Road Rage-specific damage/deadline rules, supported current/previous browser/OS matrix, reference hardware/network performance, capacity and two-person manual playtests remain outside this slice. Automation and static agent screenshot inspection cannot establish full acceptance. No failed stage gate authorizes progression.

Final verification and independent Standards/Spec reviews are recorded in the accompanying validation/review files when complete.

## Verification — 2026-10-17

The forced workspace check passed 15/15 tasks with zero cache reuse: 302 Vitest tests, all Go tests/vet/builds, generated-output verification, TypeScript checks, lint and production builds. Contact fixtures have 13 independently recomputed scenarios in both engines; TypeScript additionally checks fresh NOS and lane-lock controls, and Go checks fresh NOS.

Actual installed-Chrome runs passed both contact scenarios (swapped leader seats), the legal reserved-heart scenario, and the shipped-default obstacle scenario. The initial prior-race run passed clean/delayed delivery but failed recovering delivery at its initial NOS assertion, with subsequent room-channel loss and a blank captured page. An unchanged retry passed all three scenarios. The original failure remains a recorded transient with no established root cause; it is not erased or counted as a passing attempt. No contact had occurred before that initial assertion. All five room scenarios and all three transport scenarios subsequently passed.

The contact observations retain 684/684 samples for leader seat 0 and 706/708 for leader seat 1, with zero strict player overlaps in either client's observed authority, full HP and matching finish decisions/times. Seeds are 1918875810 and 2719985779 respectively. [Compact browser summary](evidence/contacts/browser-summary.json) records identities, results, environments and hashes; raw observations, screenshot extracts and original browser reports remain in the ignored run folders. Agent static inspection of dual-return and overtake PNGs confirms both cars, lane separation, HP HUD and active NOS presentation; this is not a two-person playtest.

The full machine-readable [validation index](contacts-validation.json) retains exact tested revisions/dirty state, fixture/configuration hashes, actual environment, original failed attempts and final run locations. The initial contact/heart runs tested the working implementation before commit `e1ab0b3` (their manifests truthfully record `ed23fe4` plus dirty changes); subsequent race/room/object/transport runs use `e1ab0b3`. No product code changed between these runs. Node 26.10.0, pnpm 8.15.9, Go 1.26.0, Apple M2, Darwin 25.5.0 arm64; actual Chrome user agents and 1280×900 contact viewports are in the browser summary.

[Independent review aggregate](contacts-review.md): Standards had one raw-log-policy finding, independently verified resolved; Spec had zero findings and independently verified all literal contact expectations. Zero outstanding review findings.

All 12 retained Long Drive/mechanics/browser preservation scenarios passed with zero retries; the `pnpm test:browser` dependency pipeline passed 7/7 tasks without cache reuse. All applicable local checks for this issue now pass. This completes the #33 slice within the gate limits above.
