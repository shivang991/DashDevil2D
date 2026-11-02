# Issue #76 validation

Implementation preserves the existing protocol, database schema and player rules.
Module ownership and lock ordering are documented in `apps/server/README.md`.

## Native and workspace checks

- Generated-output check: pass.
- Workspace typecheck, lint, tests and build: 15 successful tasks; 565 client tests.
- Final Go vet and build: pass.
- Focused generation/copy/controlled-clock multiplayer tests: pass under race detector.
- Auth publication and post-auth ticket-expiry regressions: observed failing before fix,
  passing after fix, including race detection.
- Pooled WebSocket writer lifetime: existing room-mode test reproduced the race;
  closing the pair and joining the writer before handler return passes eight runs.
- Independent Standards and Spec reviews: all findings resolved.
- Complete Go race sweep: no data races. Two password-setup HTTP requests hit
  the existing three-second client deadline under concurrent browser load; both
  failed cases pass the isolated race rerun (10.660s). Original failures retained.

## Real-browser checks

Chrome uses real HTTPS, WebSocket and WebTransport with certificate-specific trust.
Existing assertions were retained. Failed runs and browser artifacts remain in
`apps/client/test-results/transport-*`; initial failures were not overwritten.

For baseline comparisons, exported `origin/main` at
`d0d8be5b9645bf9742bf034ae560df6340ee6d20` into an isolated temporary directory.
Only local listener ports, Vite's dependency allowlist and optional test filtering
were adjusted. Assertions and gameplay behavior were unchanged. This isolates
existing browser failures from the module extraction. Temporary cache/port setup
is environment-specific, not a production change.

| Suite          | Branch result     | Main comparison                         |
| -------------- | ----------------- | --------------------------------------- |
| transport      | 3 pass            | Not needed                              |
| accounts       | 1 fail, 1 skipped | Failures reproduced                     |
| rooms          | 8 pass            | Not needed                              |
| groups         | 2 pass, 2 fail    | Failure reproduced in selected scenario |
| finality       | 2 pass            | Not needed                              |
| race           | 4 fail            | Failure reproduced in selected scenario |
| objects        | 1 fail            | Failures reproduced                     |
| contacts       | 2 fail            | Failure reproduced in selected scenario |
| hearts         | 1 pass            | Not needed                              |
| maintenance    | 1 fail            | Failures reproduced                     |
| boundaries     | 1 pass, 1 fail    | Failure reproduced in selected scenario |
| lifecycle      | 2 fail            | Failures reproduced                     |
| rage           | 1 fail            | Failures reproduced                     |
| rage-default   | 1 pass            | Also passes                             |
| dense          | 2 fail            | Failure reproduced in selected scenario |
| failures       | 2 fail            | Failure reproduced in selected scenario |
| responsibility | 1 pass, 3 fail    | Failures reproduced                     |
| admin          | 1 fail            | Failures reproduced                     |
| chat           | 1 pass            | Also passes                             |
| preservation   | 20 pass, 3 fail   | All three failures reproduced           |

Baseline failure signals include missing Chat/Leave controls, NOS staying Ready,
insufficient expected progress/contact state, missing recovery UI and admin
selectors. These are existing failures at the recorded main revision; this PR
changes no client UI, controls, protocol constants or database schema. Selected
comparisons cover a representative failing scenario, not every permutation in
multi-scenario suites. The full existing assertions remain available in CI.

The three preservation failures are `accounts-guest`, `multiplayer` and
`race-layout`. Long Drive presentation/audio/focus/navigation and other browser
checks remain in the original 23-test run. All three failed again against isolated main with the same assertions: password
minimum length expected 12/received 6, simulation value expected 160/received 200,
and missing time-remaining HUD.

Final smoke: diagnostic 3/3 passed. Room suite initially passed 8/8; final replay
passed 7/8, with the Back/Leave-dialog assertion failing intermittently. Focused
three-run retries produced 2 passes/1 failure both on this branch and isolated
main. This room-navigation flake is also baseline behavior, not hidden by retries.

## Review fixes

- Auth ordering spans durable authentication, room admission and both ticket
  publications, preventing an older resume response from pruning newer tickets.
- Ticket expiry is revalidated after durable authentication, immediately before
  consumption. A longer reconnect grace cannot revive an expired channel ticket.
- Room socket handlers close the pair and join their writer before returning the
  pooled Fiber wrapper. This removes the race observed in the existing room-mode
  regression without changing queue limits or teardown pairing.

No unresolved Standards or Spec review findings. User-owned
`docs/transport-module-split-issue.md` was not modified or committed.
