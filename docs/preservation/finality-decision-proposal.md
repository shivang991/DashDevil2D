# Proposed canonical-group continuation amendment (not yet approved)

Owners: [simulation/time decision #11](https://github.com/shivang991/DashDevil2D/issues/11#issuecomment-6124322966) and [snapshot/input decision #14](https://github.com/shivang991/DashDevil2D/issues/14#issuecomment-6142660562). Blocking implementation issue: [#36](https://github.com/shivang991/DashDevil2D/issues/36).

## Concrete failure

At60Hz, raw tick1 ends at16666.666…us. Two front-edge finishes at16666.6 and16666.8us both canonicalize to16667us, so they must tie. Current engines finalize the first crossing before discovering the second. The same clipping can put a heart after a same-canonical fatal obstacle, split simultaneous distinct damage, or award a contested pickup. Boundary inputs can also have canonical time16667 and must precede that group's collisions.

## Proposed resolution

Retain the existing half-up conversion, `n/tickRate` movement boundaries, first-terminal finality, accepted-input ordering and no retrospective input admission. Add these continuation semantics:

1. A raw tick end does not finalize an unfinished canonical event group. Carry the group until its exclusive upper time bound is passed using the correct piecewise trajectory.
2. Process already admitted inputs at every same-time tick boundary before resolving that group's pickup, damage and terminal effects. A later wall-clock arrival cannot backdate into a committed group.
3. Maintain a raw integration cursor separately from canonical event time and committed checkpoint time. Integrate each physical interval once; never accumulate rounded tick durations.
4. Publish only coherent committed authority/checkpoints. Define explicitly which tick/time and input/event watermark identify a checkpoint when its newest event group is still pending. Every initialization/correction/recovery baseline must either include sufficient pending continuation or start at the preceding complete group with all admitted input history needed to replay it.
5. Go and TypeScript must share literal fixtures for split finishes, healing/damage, distinct damage, contested pickups, next-boundary inputs, shift/return completion and exact upper-bound rounding. Real-browser recovery must exercise a pending-group boundary.

Item4 is the outstanding contract detail requiring owner confirmation before implementation; this proposal does not implicitly change the wire schema, baseline validation, watermark semantics or authority sequencing. Stage6 remains blocked for #36 until the amendment, scheduler, independent review and required regressions pass. Existing tests do not waive the new failing gate.
