# Define the snapshot and input protocol

**GitHub issue:** [Define the snapshot and input protocol](https://github.com/shivang991/DashDevil2D/issues/14)
**Local snapshot ID:** 12
**Parent:** [DashDevil Multiplayer — implementation-ready specification map](https://github.com/shivang991/DashDevil2D/issues/2)
**Labels:** wayfinder:grilling
**Status:** open
**Assignee:** unassigned
**Blocked by:** [Define the authoritative simulation and time contract](09-authoritative-simulation.md); [Choose prediction and correction behavior](10-prediction-and-correction.md); [Choose the supported gameplay transport](11-transport-contract.md)

## Question

What input messages, acknowledgements, snapshots, synchronization messages, and round events are required? Decide full versus delta snapshots, cadence, sequences, timestamp units, authoritative fields, correction/replay information, payload limits and malformed/version-mismatched behavior. Determine what measured bandwidth budget justifies bit packing/custom binary encoding and define a Go/TypeScript compatibility contract; no encoder implementation.

