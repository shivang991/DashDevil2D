# Choose module and monorepo boundaries

**GitHub issue:** [Choose module and monorepo boundaries](https://github.com/shivang991/DashDevil2D/issues/15)
**Local snapshot ID:** 13
**Parent:** [DashDevil Multiplayer — implementation-ready specification map](https://github.com/shivang991/DashDevil2D/issues/2)
**Labels:** wayfinder:grilling
**Status:** open
**Assignee:** unassigned
**Blocked by:** [Define the Long Drive preservation contract](01-long-drive-preservation.md); [Define the authoritative simulation and time contract](09-authoritative-simulation.md); [Define the snapshot and input protocol](12-wire-protocol.md)

## Question

How should the React/Vite client, Go/Fiber server, mode processors, input layer, renderer, networking and shared definitions be separated in the Turborepo? Specify ownership of game state, simulation lifecycle, effects/audio, React notifications, configuration and cleanup, plus how Go and TypeScript contracts stay aligned. Examine the proposed InputManager → ModeProcessor → Renderer pipeline and GameWorld interface as design candidates. Define build/test orchestration without writing configuration or code.

