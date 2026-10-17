# Original failures

- Initial TDD run: `pnpm --filter @dashdevil/client exec vitest run tests/simulation/contacts.test.ts`: boosted follower advanced to 160 instead of 100 at 0.2 s, passing through the leader's rear rectangle. Retained before implementation.
- Initial shared Go follower test also failed at progress 160 instead of 100 before native implementation.
- Harness development errors: Go parser interpreted an unspaced `<-` as a channel operator; one command ran from the server directory using repository-relative paths; initial TS test incorrectly read context from snapshot rather than capturing configuration. Corrected before acceptance checks.
- Initial shared-fixture test expected a reliable tailgating event at a tick endpoint. No control/phase changes there: geometry-derived blocking starts at that exact boundary; the fixture now checks the exact contact-constrained progress without inventing an event requirement. Mid-tick impacts do emit contact state.
- `boundary-red.log`: new forward-impact fixture failed because tailgating hid requested closing motion. The correction initially returned the leader during sideways clearance; this was caught by the existing release fixture and restricted to a shifting follower.
- `check-first.log`: retained steering expectation failure and sandbox listener denials. Free-steering test setup isolates the opponent longitudinally; authorized final checks use real listeners.

All named raw logs are retained under ignored `apps/client/test-results/contacts-implementation/logs/`, following the preservation evidence policy. Original browser run folders remain intact.

- Prior race suite: original `transport-2026-10-17T06-28-24.242Z` passed clean/delayed and failed recovering at initial NOS readiness, then lost room channel and captured blank page. Root cause is not established. No product/test changes preceded retry `transport-2026-10-17T11-39-07.000Z`, which passed all three. Both complete runs and logs remain retained. This is not counted as proof that an underlying transient can never recur.
