# Independently reviewed Long Drive expectations

Reviewer: exploration subagent `/root/baseline_expectations`, 2026-10-14. Product/test implementations were not used as an oracle; review reads the governing resolutions, implementation-ticket ownership, and original source via `git show a68f27efd1d79ec8eea7ef0b0a6d8567606189dd:<path>`. No Git or product/test mutation performed. This review establishes expectation provenance, not execution evidence or human audiovisual approval.

## Authority

- [Preservation](https://github.com/shivang991/DashDevil2D/issues/3#issuecomment-6118779020)
- [Verification](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139)
- [Stage gates/applicability](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401)
- Geometry detail: [world model](https://github.com/shivang991/DashDevil2D/issues/5#issuecomment-6119616392)

Original files inspected: `useGameContext.ts`, `useGameInput.ts`, `useGameLoop.ts`, `constants.ts`, `GameScreen.tsx`, `gameAudio.ts`. Original rendering source should also be inventoried/captured by the implementer.

## Literal retained expectations suitable for reviewed fixtures

| Scenario | Independent expected outcome |
| --- | --- |
| Fresh first start | HP 2, score 0, target/visual lane 1 (zero based), no objects, speed 400, spawn interval 1.0 s, stationary gameplay in countdown for 5 s; displayed value is ceiling of remaining time. |
| Restart or explicit-reset start | 3 s countdown; HP 2, score 0, lane 1; objects, difficulty and effects reset; fresh grass appearance; current viewport respected. |
| Collect one coin | Exactly +10 score and consumption; HP unchanged; also collectible while invincible; no distance/survival/avoidance score. |
| One nonfatal obstacle from HP 2 | HP 1, consumed obstacle, invincibility 2 s, nominal three blink cycles, shake 0.5 s. |
| Obstacles during invincibility | All contacted obstacles consumed, HP unchanged. |
| Coin plus fatal obstacle, starting HP 1/score 0 | Score 10, HP 0, coin and contacted obstacles consumed; gameplay freezes; stronger shake multiplier 1.5 lasts 0.5 s, fade reaches 0.75 at rate 2, game-over overlay waits for both. |
| Multiple fatal-overlap obstacles, starting HP 1 | HP ends exactly 0, only one terminal transition; health cannot become negative. This is a correction expectation, not observed baseline behavior. |
| Lane bounds/repeat | Lane targets remain 0..2; fresh steering changes target immediately when available; held steering repeats with 0.15 s cooldown, reaching boundary then stopping. Baseline smoothing rate 10; tilt max 1 rad, interpolation rate 12. Do not mistake FPS-dependent interpolated positions for exact frame-independent oracle values. |
| Latest-key replacement | Up held then Right press => Right only, acceleration off; Right release => no movement, even though Up remains physically held. Left/right and a/d, up/w mappings retained. |
| Acceleration | Unlimited held input; speed multiplier 10, vertical target 80 units upward, easing rate 8; release returns to base; spawn cadence unchanged by acceleration. |
| Difficulty | At completed active second n: speed `min(400+15*n,900)`; interval `max(1-0.03*n,0.35)`. Literal milestones: n=1 => 415/0.97; n=22 => 730/0.35; n=34 => 900/0.35; later stays capped. Paused/away time contributes zero. |
| Controlled spawn | One lane uniformly from three, one coin if kind draw <0.45, otherwise one obstacle. No hearts at Long Drive defaults. Existing baseline draws lane before kind; separately control decorative/audio randomness to avoid seed contamination. |
| Collision bounds | Strict AABB overlap; car 50x80, coin 28x28, obstacle 48x40; touching edge alone is not object contact. Interpolated actual lateral position and actual vertical position govern; visual tilt does not rotate hitbox. Future world lane-center separation 120 units. |
| Pause/focus | Pause freezes all gameplay/effect timers; resume no catchup. Blur/hidden clears keys/commands and pauses active play; focus requires Space to resume. Countdown freezes away, continues remaining time on return. |
| Command availability | Space only active play, Enter only completed game-over animation; unavailable commands discarded; autorepeat cannot retoggle pause; browser defaults prevented. |

Expected score/HP/lane-target/consumption/lifecycle decisions match exactly across 30/60/120 rendering FPS. Milestones within 50 ms active time. Go/TS continuous positions eventually use absolute tolerance `0.000001 + 1e-12*abs(expected)` world units; this tolerance never excuses differing events/identities/times/outcomes. Canonical event times and wire bytes are exact. These are contractual expectations, not a claim that the historic loop satisfies every row.

## Historic defects and owning mandatory correction slice

| Historic source evidence | Correct expectation | Owner |
| --- | --- | --- |
| Difficulty uses `>` and resets accumulator to 0; spawn resets accumulator to 0; steering resets cooldown | Active-time milestones/cadence retained without render-frame drift | #22 timing; #26 exact spawn anchors/track cadence |
| Shake decremented before paused-state early return | All effects freeze while paused | #22 |
| Fatal filter resets invincibility to 0 and continues health decrement for further overlaps | Clamp HP to zero, one fatal transition, proper consumption | #22 |
| Collision checks only final positions each rendered update | Swept longitudinal/lateral contacts prevent tunneling | #26 (headless reusable seam #22) |
| laneX derives collision positions from canvas width/road ratio | World geometry invariant under resize | #26 |
| Resize updates canvas but never initialized carYBase; reset carries stale base | Current viewport adapts presentation; geometry not resized | #23 session/reset presentation, #26 view/world mapping |
| Keydown accepts repeats, no preventDefault, no blur/visibility listeners; pending commands persist until polled | Repeat suppression/default prevention/early discard/held-key clearing/focus lifecycle | #23 |
| Input includes touch gesture/hold listeners | Keyboard only | #23 |
| Mutable module-level `_state` reused across mounts | Independent owned sessions, complete reset/teardown | #23 |
| HUD always says Accelerating, mode still Solo Trip | State-correct acceleration text, Long Drive naming | #23 |

Do not label these as preserved desired behavior or turn expected historic failures into green corrected acceptance. Record observed historic failure with reproducer and eventual owner. When an owner introduces a correction, its corrected check is mandatory and retained thereafter.

## Stage 1 pass requirements

1. Identify/reproduce exact historic revision and capture actual browser viewport 1280x900 **plus measured** CSS canvas rectangle and canvas backing width/height. Source layout (`sm:w-160`, HUD/padding/border) is insufficient to claim actual dimensions. Keep browser/OS/hardware version, seed/configuration/fixture version, input/object script and run timestamp.
2. Record repeatable baseline outcome/timing logs at 30/60/120 rendering FPS. Separate retained expectations from explicit historic defect characterization; no unowned exceptions. Establish executable retained checks and corrected expectation cases that activate by owning slice. A known later-owned correction is not an unrelated retained-regression waiver.
3. Capture road/car/textures, motion/tilt/acceleration, hit blink/shake/fade, HUD/countdown/pause/gameover presentation, audio cues/engine/boost/exhaust, mute/unlock/hidden audio and optional-audio behavior. At reference and additional sizes, retain screenshots/clips and observations. Pure state checks cannot prove recognizable audiovisual feel.
4. Requirement-to-evidence checklist links every applicable scenario and correction owner to its actual artifacts/logs or explicit unfulfilled prerequisite. Preserve original failures through retries with explanations.
5. Long Drive playable; applicable checks pass; independently reviewed expectation source is recorded. Vitest becomes required when introduced. Go/shared compatibility/generated-output/two-browser real-transport suites explicitly unavailable until their components exist, then mandatory. Browser baseline checks are applicable now even though actual multiplayer transport is absent.
6. Distinguish Stage 1 evidence from full multiplayer acceptance. No Stage 2 start after a failed or unfulfilled Stage 1 gate unless the governing decision is explicitly reopened.

The stage sequence explicitly places input/timing/geometry fixes in later slices, so Stage 1 must characterize and register those historic defects rather than pretend they are already fixed. This interpretation does not remove baseline capture, runnable checks or required manual evidence. If the implemented gate cannot reconcile a required retained check or missing capture/manual requirement, report it blocked rather than declaring success.

## Human/real-environment evidence

Human side-by-side playthrough/visual-audio findings remain required by preservation and verification. A subagent's source review or automated screenshot/audio-invocation check does not count as having watched/listened to a human comparison or verified felt equivalence. Supported actual stable browser releases need supplementation beyond bundled automation engines. Record observers, browser/environment, baseline/candidate revisions, scripts, artifacts and unresolved findings. Later multiplayer acceptance additionally requires recorded two-person playtests, network matrix, hardware/performance sampling and capacity evidence; do not manufacture those as Stage 1 passes.
