# #41 capacity and operating-model checkpoint

Issue: [Handle capacity admission, cleanup, maintenance and restart](https://github.com/shivang991/DashDevil2D/issues/41). Date: 2026-10-18 America/Phoenix. Owner-confirmed review baseline: `a9b3cc9`. Implementation: `b57d995`. The owner confirmed existing server admission/lifecycle APIs and two-browser real transports as test seams.

## Implemented change

The operating decision requires an initial **configurable** 50-room limit. The existing implementation counted the shared room map but hard-coded 50. `transport.Config.RoomLimit` now defaults to 50, validates 1–10000, and is exposed as `--room-limit`. Creation counts the complete room map, including all phases and reservations. Existing joins and reconnects remain eligible. A structured capacity-rejection record includes room count and limit, never credentials or tickets.

The new real HTTPS regression sets capacity to one: a second creation returns 503 and exactly “Server full. Try again later.”; joining the existing room and resuming its host remain successful. A fresh-server regression verifies a previous process's credential returns 410 and exactly “Room expired”, followed by successful fresh creation. No result is manufactured. The initial test failed to compile before the configuration field was added. Original logs remain retained.

## Governing requirements and evidence

- [Operating model](https://github.com/shivang991/DashDevil2D/issues/18#issuecomment-6147409056): capacity configuration and new public admission/restart regressions above. Existing listener errors are reported to the process supervisor loop in `cmd/diagnostic/main.go`; either public listener failure causes shutdown and nonzero exit. This checkpoint does not claim a newly executed listener-failure injection or 100-player load test.
- [Lifecycle](https://github.com/shivang991/DashDevil2D/issues/8#issuecomment-6120278462) and [authority/time](https://github.com/shivang991/DashDevil2D/issues/11#issuecomment-6124322966): existing maintenance unit/integration and exact-cutoff tests remain mandatory. The current real-browser maintenance scenario passed: active play continues, confirmed results remain final, unfinished rounds are abandoned at the configured deadline and rooms close.
- [Screens/input](https://github.com/shivang991/DashDevil2D/issues/19#issuecomment-6147750725): capacity and expired-room response strings remain exact. No UI or Long Drive source/defaults/assets change.
- [Verification](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139): forced workspace checks passed 15/15 tasks with no cache reuse, including generated output, TypeScript, lint, Go vet/test/build, shared fixtures and 434 Vitest checks. These do not establish full acceptance.
- [Stage gates](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401): **Stage 6 exit remains blocked**. No next-stage advancement is authorized by this checkpoint.

The current preservation browser run passed all 12 scenarios (`pnpm test:browser`), retaining its original trace/video/screenshot and fixture/configuration provenance under `apps/client/test-results/`. Its complete command output is `apps/client/test-results/capacity-issue41/logs/issue41-preservation.log`. No human audiovisual signoff is inferred.

## Independent review

The code-review skill ran separate Standards and Spec agents on `git diff a9b3cc9...b57d995`. Standards: no actionable violations or smells. Spec: no new product defect or scope creep. Independent expected values are capacity one: reject the next create, preserve join/reconnect; fresh process: reject old credential with 410. Spec explicitly reported missing operating evidence and the inherited mandatory dense Road Rage failure. Neither axis claims full issue acceptance.

## Current retained runs and limitations

Complete command logs, including the original sandbox socket denial and subsequent successful workspace run, live in ignored `apps/client/test-results/capacity-issue41/logs/`. Original failed runs are not replaced by retries.

Maintenance real-transport evidence: `apps/client/test-results/transport-2026-10-19T01-59-26.338Z/` (one scenario passed). Dense reproduction: `apps/client/test-results/transport-2026-10-19T02-00-35.508Z/` (Drag Race passed, Road Rage failed its NOS-active assertion). A single-variable foreground-focus diagnostic reproduced the same failure at `apps/client/test-results/transport-2026-10-19T02-01-41.942Z/`; the diagnostic source change was removed. The server records rejected Road Rage inputs; the root cause remains unresolved. Both original failure runs and their provenance, random seeds, configuration hashes, browser versions, logs, screenshots and traces remain intact. No requirement was weakened or excluded.

Actual environment: macOS/Darwin arm64 on Apple M2, Node 26.10.0, pnpm 8.15.9, Go 1.26.0; actual Chrome with two 1280×900 contexts. Exact per-run versions and hashes are in each run's provenance. This is not the required Linux reference server with two dedicated cores and 2 GiB RAM. The required both-mode, 50-room/100-player, 30-minute acceptance run has not been performed here. Packet-level ordinary and initialization/recovery burst measurements remain unavailable as recorded in the [#40 checkpoint](failures-checkpoint.md); application counters cannot substitute for transport-inclusive bytes. Supported-browser matrix, complete private observability/resource-lifetime evidence and human audiovisual acceptance are also not established by these runs.

Issue #41 cannot yet be represented as resolved: the configurable-capacity gap is repaired, but mandatory inherited browser and operating-model acceptance requirements remain outstanding. This checkpoint preserves those failures rather than closing a failed gate.

The owner confirmed in this session: **“No reference environment available; record the blocker.”** The Linux load and packet-measurement prerequisites are therefore explicitly unavailable. The independently reviewed [validation index](capacity-validation.json) retains current run manifests and hashes.
