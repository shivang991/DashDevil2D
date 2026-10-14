# Define the authoritative simulation and time contract

**GitHub issue:** [Define the authoritative simulation and time contract](https://github.com/shivang991/DashDevil2D/issues/11)
**Local snapshot ID:** 09
**Parent:** [DashDevil Multiplayer — implementation-ready specification map](https://github.com/shivang991/DashDevil2D/issues/2)
**Labels:** wayfinder:grilling
**Status:** open
**Assignee:** unassigned
**Blocked by:** [Define the discrete track and world model](03-track-model.md); [Define Road Rage collision responsibility](04-road-rage-collisions.md); [Define round outcomes and event precedence](05-round-outcomes.md)

## Question

How will server and client simulations advance time and agree on movement, collision geometry, event ordering, randomness, and state? Define the round's zero origin, tick boundaries, clock synchronization, trustworthy input timestamps, input validation, late inputs, and the limits of parity between Go and TypeScript. Which states are predicted and which remain server-only, especially HP, pickup consumption, collisions, and final outcomes?

