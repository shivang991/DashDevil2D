# Choose prediction and correction behavior

**GitHub issue:** [Choose prediction and correction behavior](https://github.com/shivang991/DashDevil2D/issues/12)
**Local snapshot ID:** 10
**Parent:** [DashDevil Multiplayer — implementation-ready specification map](https://github.com/shivang991/DashDevil2D/issues/2)
**Labels:** wayfinder:grilling
**Status:** open
**Assignee:** unassigned
**Blocked by:** [Define casual internet play acceptance targets](08-internet-play-targets.md); [Define the authoritative simulation and time contract](09-authoritative-simulation.md)

## Question

Given authoritative rules and quality targets, what should local and remote players see during lane shifts and NOS transitions, and how should corrections be applied? Evaluate the prompt's slower-local/faster-remote lane shifts and NOS speed adjustments for fairness and collision consistency. Decide whether adjusted speed is presentation-only or changes predicted state, behavior when a target timestamp has already passed, missing input/snapshots, and handling predicted damage while final outcomes remain server-only.

