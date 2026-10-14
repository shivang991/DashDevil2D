# DashDevil Multiplayer — implementation-ready specification map

**GitHub issue:** [DashDevil Multiplayer — implementation-ready specification map](https://github.com/shivang991/DashDevil2D/issues/2)
**Local snapshot ID:** map
**Labels:** wayfinder:map
**Status:** open
**Assignee:** unassigned

## Destination

An implementation-ready specification for restructuring DashDevil and supporting Long Drive, Drag Race and Road Rage, with gameplay, system boundaries, networking choices and acceptance criteria settled. This effort ends before implementation.

## Notes

- Source: [DashDevil Multiplayer prompt](../../../prompt.md). The user confirmed the destination and scope in this chat.
- Preserve Long Drive pause, scoring, difficulty and other observable behavior; remove touch controls. All modes target keyboard devices.
- Multiplayer uses a shareable four-digit room code and targets casual internet play between friends.
- Treat proposed architecture, transport and latency compensation as choices to examine. Server-authoritative multiplayer outcomes remain a requirement.
- React + Vite, Go + Fiber, Turborepo, centralized configuration and discrete track arrays are requested foundations; clarify their contracts through the tickets.
- Consult wayfinder, grilling and domain-modeling in each decision session; research tickets also consult research. No product code, test code, configuration implementation or executable prototypes at this stage.
- GitHub is now the canonical tracker. This file is a local charting snapshot; see [Tracker operations](TRACKER.md) before continuing.
- Initial source inspection: standalone client; server has only a placeholder. Existing held acceleration is not yet defined as NOS. Current collision positions depend on canvas dimensions.
- Scope confirmations are standing constraints, not resolved decision tickets. Charting resolves no human decision ticket.

## Decisions so far

- [Research browser and Go transport feasibility](https://github.com/shivang991/DashDevil2D/issues/9): Feasible building blocks identified; browser interoperability, Go HTTP/3 integration and stream ordering constrain the later transport decision.

## Not yet specified

- Further questions exposed by concrete collision/input timelines and the selected simulation/time contract.
- Details of cross-mode reuse and migration seams that become apparent after module ownership and regression evidence are settled.

## Out of scope

- Product implementation, executable prototypes, deployment, and implementation-task breakdown.
- Touch controls and mobile-device interaction.
- Accounts/login, name editing, public matchmaking, ranking, persistent results and database integration.
- Sophisticated anti-cheat and competitive-play infrastructure; normal authoritative input validation remains in scope.

