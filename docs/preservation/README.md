# Long Drive Stage 1 preservation record

**Stage 1 status: BLOCKED / incomplete evidence. #21 remains open; #22 must not start.**
This ticket installs a runnable characterization harness without changing product gameplay. Automated checks pass, but the required baseline audiovisual coverage and human comparison are incomplete. Known explicitly authorized defects belong to later slices and are not preserved gameplay requirements.

## Authority and baseline

- Baseline: `a68f27efd1d79ec8eea7ef0b0a6d8567606189dd`.
- Integration start: `23979fb648636a46e763240bafb3c1965749758c`; ticket branch starts at that tip.
- [Preservation resolution](https://github.com/shivang991/DashDevil2D/issues/3#issuecomment-6118779020).
- [Verification resolution / approved seams](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139).
- [Sequence, gates and applicability](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401).
- [Independent literal expectation review](independent-expectations.md) was prepared by a separate reviewer from these contracts before reviewing the tests. This is contract review, not human audiovisual signoff.

`evidence/baseline-source-diff.log` is empty: product sources and public assets at the integration start match the pinned baseline. Browser capture therefore runs those unchanged sources; no private update function was exported and no production test backdoor was added. New files are test/configuration/evidence only. The existing pnpm 8 lockfile is extended for the harness while retaining existing product dependency resolutions.

## Running mandatory introduced checks

From `client`, use Node capable of the pinned tooling (capture used Node 26.10.0), pnpm 8.15.9:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm test:browser
pnpm build
pnpm lint
```

Browser setup: install actual Google Chrome (the default `channel: chrome`) and run `pnpm exec playwright install ffmpeg`. Video and trace recording are enabled; failures are not automatically retried. Generated `client/test-results` may be copied into a new uniquely named evidence run directory. Never overwrite an original failed run.

For the owning correction slice, run `PRESERVATION_ENFORCE=22 pnpm test`, similarly `23`, `26`, or a comma-separated list / `all`. Corrected checks then become ordinary mandatory passing assertions. Baseline mode uses `test.fails` to expose the existing defect explicitly and also fails on an unexpected pass. This is **not a correction acceptance pass**. Do not carry these expected failures into the owning slice. Additional corrected expectations below must be added when those slices introduce their seams.

## Reproduction configuration and boundaries

Fixture/configuration version: 1; unchanged baseline `gameConfig`. Behavioral hook harness controls performance/RAF and randomness at platform boundaries (constant random sample 0.5); scripted object fixture canvas is 606×802, car top 682. These fixture dimensions are deliberately scenario setup, **not** browser layout evidence. Real `useGameContext`, `useGameInput`, `useGameLoop` are mounted together; test-only setup supplies initial objects using the existing context interface. jsdom has no canvas/audio output; successful hook tests prove outcomes, not presentation. Hook characterization legitimately begins green against existing behavior; there is no new game implementation requiring invented red evidence. Eight corrected assertions are retained red in `authorized-corrections-observed.log`.

Browser fixture: seed 21, LCG platform randomness, public menu/keyboard/UI only. First browser check uses Playwright's controlled clock; separate real-time playthrough records motion. `browser-environment.json` records actual platform/browser/viewport/canvas; measured reference canvas is 606×806 at 1280×900. Current actual Chrome was captured; other supported releases and platforms are not claimed. Hardware equivalence/power settings are not established. Video records screen content without sound. `baseline-audio.webm`, if nonempty, records a parallel Web Audio output sink through MediaRecorder; bytes establish capture availability, **not** audible equivalence or human listening. See `audio-capture.json` for cue scope.

## Requirement-to-evidence checklist

| Preservation requirement | Executed evidence | Remaining evidence / owner |
| --- | --- | --- |
| defaults, middle lane, HP 2, score 0, empty road | retained tests; browser HUD | first mount asserts full core defaults; browser verifies first 5-second countdown |
| restart 3-second stationary countdown within 50 ms | retained tests at 30/60/120 | complete reset grass/resize presentation comparison pending |
| lane bounds, held repeat, latest key replacement/release | retained tests at all three FPS; public keyboard video | held cooldown and aliases covered at all three FPS |
| base speed, 10× acceleration, easing/release | retained tests at all FPS; acceleration screenshot/video/audio capture | independent perceptual motion/audio review pending |
| spawn first milestone, lane, difficulty growth/caps | seeded retained tests all FPS | lane thirds / coin 0.45 boundary also executed; multi-interval timing residue pending |
| strict AABB and interpolated car location | vertical edge retained test all FPS | lateral interpolated lane, actual vertical and tilt-independent bounds covered at all FPS |
| coin + fatal obstacle precedence, exact consumption | retained tests all FPS | browser HUD on scripted coin/fatal scenario not captured |
| nonfatal hit, invincibility, coin while protected | retained tests all FPS; timer check | blink/effect milestones executed; hit-shake playthrough captured, human review pending |
| fatal freeze, overlay after fade/shake, restart | retained fatal/restart tests all FPS | fatal freeze tested all FPS; rendered gameover and menu-return public check recorded |
| pause freezes road/lane/spawn/difficulty | retained tests all FPS; public pause overlay | shake pause corrected expectation owned #22 |
| blur/hidden tab, fresh input, early commands, autorepeat/default suppression, touch removal | eight defect reproductions (partial) | complete input scenarios corrected and mandatory in #23; hidden-tab countdown/browser scenarios missing |
| resize equivalence | actual extra-viewport measurement and pause screenshot | collision equivalence is intentionally unproven; #26 owns geometry; human resize presentation pending |
| textures/road/car/HUD/countdown/pause | PNGs, actual Chrome real-time video + trace | human side-by-side comparison missing; hit/gameover playthrough recorded; detailed human blink/shake/fade review pending |
| countdown/GO, engine, acceleration/release, lane/pause audio | platform audio recording if nonempty; mute preference public check | damage/gameover/resume recorded; isolated coin captured; controlled hidden output measured at zero RMS; native hidden-tab supplement and human audition pending |
| optional unavailable audio | hook harness with no audio still playable | AudioContext failure browser scenario executed; gesture-based unlock used in public capture; controlled hidden-tab platform output verified separately; native tab suspension supplement pending |
| exact outcomes across 30/60/120, active-time milestones ≤50 ms | 39 retained hook cases, no tolerance on discrete outcomes | retained core scripted matrix executed; remaining corrected lifecycle scenarios belong later slices; not full preservation acceptance |
| retained failure evidence | original/retry logs, traces and failure PNG | each future retry must append a new run, retain explanation |

## Authorized correction ownership (mandatory at introduction)

| Owning slice | Corrected expectation | Current observation / evidence |
| --- | --- | --- |
| #22 headless extraction | pause all effect timers; HP clamp and fatal-event termination | pause shake advances to 0.3 instead of remaining 0.5; two fatal obstacles produce HP -1; recorded red tests |
| #22 | exact active-time timer accumulation/no frame residue loss | multi-interval milestone fixture not yet complete; mandatory when headless timing introduced |
| #23 GameSession/input integration | blur/hidden clears held input and pending commands; active play pauses until explicit Space; countdown freezes while away | blur leaves acceleration true and play unpaused; recorded red test; hidden visibility case pending |
| #23 | ignore repeated Space/default prevention; discard early pause/restart; remove touch; independent sessions/teardown | repeated Space pauses; early countdown pause survives; recorded red tests; remaining cases pending |
| #23 | Long Drive naming, accurate acceleration HUD, fresh responsive reset presentation | screenshots show baseline “Accelerating!” even at rest; corrected browser tests mandatory at integration |
| #26 geometry/track migration | swept high-speed collision and viewport-independent geometry; stable consumption | 30 FPS boosted obstacle tunnels without damage; recorded red test; resize collision comparison pending |

Continuous future Go/TypeScript positions allow only `0.000001 + 1e-12 * abs(expected)` world-unit error; discrete decisions/event times/identities/consumption/wire bytes match exactly. Current tests do not claim Go/TS parity or world-coordinate tolerance applicability.

## Check applicability and Stage 1 exit

| Check | Status / prerequisite |
| --- | --- |
| Vitest | introduced, required now; retained cases pass and eight explicitly classified corrected assertions remain red |
| browser Long Drive scenarios | introduced, required now; actual Chrome public checks executed; full preservation scenarios incomplete |
| build/typecheck/lint | required now; see logs and retained failed lint log / retry |
| Go tests | unavailable: no Go module/server component exists |
| shared Go/TS compatibility fixtures | unavailable: no contracts/shared simulation components exist; hook fixtures are not parity fixtures |
| generated-output checks | unavailable: no generated contracts/codecs component exists |
| two-browser real-transport smoke | unavailable: no admission/room/gameplay transport/server exists; two pages without transport are not a substitute |

**Gate blockers:** recorded human side-by-side visual/audio comparison missing. Isolated coin audio is captured separately; controlled visibility audio output reaches silence, while actual native tab suspension remains a later browser supplement. Actual baseline environment is recorded; reference-hardware equivalence/power-performance qualification belongs to the later acceptance stage and is not claimed here. Known later-owned defect observations alone are not failed retained behavior, but incomplete required Stage 1 evidence is a blocker. Do not claim full acceptance from passing tests or recorded automation. #22 may proceed only after this evidence gate passes or the governing decision is explicitly reopened by its owner.

Original failures: initial pnpm execution could not auto-install its pinned manager in the sandbox (`vitest-initial.log`); an install/test overlap temporarily removed a worker dependency (`authorized-corrections-red.log`); initial browser invocation lacked dependencies (`browser-initial.log`); first runnable browser test allowed real elapsed time before the virtual countdown assertion (`browser-attempt-2.log`, archived trace/PNG), fixed by pausing the clock before navigation; video needed the matching ffmpeg (`browser-video.log`, archived traces), installed before retry; lint rejected publishing a hook context during render (`lint.log`), fixed by publishing through an effect. Product source remained unchanged throughout.

Additional original failures retained: JSX fixture needed automatic JSX transformation (`vitest-final-3.log`); lateral fixture accidentally retained the zero-width jsdom resize road ratio (`vitest-complete.log`), corrected to the documented 0.6 scenario ratio; a full playthrough reached gameover/audio capture but lost its canvas before the final resize assertion (`browser-full-playthrough.log`, trace retained); resize is now captured while paused, and test edits are completed before the browser run to avoid development-server reloads. These are harness failures, not modified baseline expectations.

Final isolated cue evidence: `baseline-coin.png` proves Score 10 after a public seeded coin contact; `baseline-coin-audio.webm` preserves that cue. `audio-hidden-platform-fixture.json` records visible RMS >0 and hidden RMS 0 from the actual Web Audio sink under controlled `document.hidden`/visibilitychange. This is a platform fixture, not native-tab scheduling evidence. Human audition remains pending.

Virtual-clock screenshots of acceleration/pause produced identical stale compositor output despite successful DOM assertions (retained as `virtual-*-unreliable.png`); these are explicitly invalid presentation evidence. The labelled acceleration/pause snapshots are captured in the real-time playthrough after real frame waits. Unit/DOM/clock advancement is not evidence of screen-visible presentation.
