# Spec review — issue #33

Fixed point: `ed23fe4`; reviewed `git diff ed23fe4...HEAD`, implementation commit `e1ab0b3` (`Implement swept Drag Race car contacts, returns and tailgating (#33)`).

No actionable Spec findings.

The requirement “swept contact handles touching/separating, single/dual shifts and existing returns without teleport/restart timers” is implemented by intersecting lateral/forward intervals, returning only phase-1 cars, and retaining phase-2 origins/timers. Reviewed zero-time contacts for progress: new shifts become returns; ordinary rear contacts acquire a speed constraint; separating contacts have no positive interval. No reachable repeated zero-time loop or pass-through was established.

“Tailgate actual speed and lane lock until geometric separation retaining requested NOS equal-speed lock” is reflected in movement, object checks and finish checks using the constrained multiplier, with a sub-tick split at lateral clearance. Requested controls remain intact except when entering return. “Returns disable NOS require fresh inputs, objects normal” is covered by clear-on-return, ignored return presses, ignored inactive refreshes, and the retained object resolver.

Both implementations use the same chronological collision/object/finish loop, and reliable contact records carry both cars. Rendering remains outside simulation geometry. All 13 literal shared scenarios were independently recomputed in `fixture-review.md`, including integrated acceleration and nearest-microsecond decisions.

The two-context browser scenario covers both leader seats, dual returns, separate-lane NOS overtaking, persistent rear contact, blocked steering, sideways release, intact HP and matching authoritative finish. Its assertions and attachments establish this slice only. The checkpoint correctly quotes the acceptance limitation: “Automation and static agent screenshot inspection cannot establish full acceptance.” Hardware/network/browser-matrix and two-person manual gates remain outstanding outside #33's slice.

Shared Road Rage movement reuse is consistent with governing #4; no Road Rage-specific damage is introduced. Changes to free-steering/heart setup remove newly illegal overlap while retaining deterministic contested-pickup checks. No unrelated product behavior or unjustified scope expansion identified.

Result: 0 findings. Static review and independent calculations do not substitute for the parent's final suite/evidence verification.
