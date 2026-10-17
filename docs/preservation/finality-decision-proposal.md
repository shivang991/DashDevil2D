# Approved canonical-group continuation amendment

Owners: [simulation/time decision #11](https://github.com/shivang991/DashDevil2D/issues/11#issuecomment-6124322966) and [snapshot/input decision #14](https://github.com/shivang991/DashDevil2D/issues/14#issuecomment-6142660562). Resolved implementation issue: [#36](https://github.com/shivang991/DashDevil2D/issues/36).

## Concrete failure

At60Hz, raw tick1 ends at16666.666…us. Two front-edge finishes at16666.6 and16666.8us both canonicalize to16667us, so they must tie. The original engines finalized the first crossing before discovering the second. The same clipping can put a heart after a same-canonical fatal obstacle, split simultaneous distinct damage, or award a contested pickup. Boundary inputs can also have canonical time16667 and must precede that group's collisions.

## Approved resolution

Retain the existing half-up conversion, `n/tickRate` movement boundaries, first-terminal finality, accepted-input ordering and no retrospective input admission. Add these continuation semantics:

1. A raw tick end does not finalize an unfinished canonical event group. Carry the group until its exclusive upper time bound is passed using the correct piecewise trajectory.
2. Process already admitted inputs at every same-time tick boundary before resolving that group's pickup, damage and terminal effects. A later wall-clock arrival cannot backdate into a committed group.
3. Maintain a raw integration cursor separately from canonical event time and committed checkpoint time. Integrate each physical interval once; never accumulate rounded tick durations.
4. Publish only coherent committed authority/checkpoints. Define explicitly which tick/time and input/event watermark identify a checkpoint when its newest event group is still pending. Every initialization/correction/recovery baseline must either include sufficient pending continuation or start at the preceding complete group with all admitted input history needed to replay it.
5. Go and TypeScript must share literal fixtures for split finishes, healing/damage, distinct damage, contested pickups, next-boundary inputs, shift/return completion and exact upper-bound rounding. Real-browser recovery must exercise a pending-group boundary.

The owner approved this amendment in the implementation chat on2026-10-17. It is recorded on [#11](https://github.com/shivang991/DashDevil2D/issues/11#issuecomment-6239984034) and [#14](https://github.com/shivang991/DashDevil2D/issues/14#issuecomment-6239984266).

The selected checkpoint rule is to retain the preceding committed checkpoint and withhold the affected tick's authority records while a group remains open. Initialization/correction/recovery baseline capture waits for closure before reading matching state and watermarks, under the existing one-second deadline. Pending groups are not added to the wire schema. Internal raw tick/cursor state and TypeScript's explicitly provisional prediction view do not become authority checkpoints.

Sampling preserves the existing tick/time representation: when a group's canonical timestamp equals a raw tick boundary's canonical timestamp, use that raw boundary for continuous checkpoint positions; otherwise use the canonical center. Discrete changes in the group are resolved before terminal evaluation. This preserves restoration from existing tick/time fields without repeatedly rounding movement intervals. Successful finish crossings clamp the front edge to the line.

Terminal lifecycle requests settle gameplay through their exact cutoff first; reconnect expiry also caps catch-up so a later finish cannot overtake an earlier deadline. Seat-generation resets queued during an open group apply only after a nonterminal commit. Final outcomes ignore those resets. Existing maintenance/application deadlines and the bounded authority history still apply.

Independent review and required checks remain mandatory before #36 is closed. The historical failure and preliminary blocked reports remain retained; approval alone is not a passing gate.

The amendment is implemented and the issue36 gate passes; final reviews and all required checks are indexed in `finality-validation.json`. Historical failing probes remain retained.
