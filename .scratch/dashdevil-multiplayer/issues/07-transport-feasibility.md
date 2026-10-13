# Research browser and Go transport feasibility

**GitHub issue:** [Research browser and Go transport feasibility](https://github.com/shivang991/DashDevil2D/issues/9)
**Local snapshot ID:** 07
**Parent:** [DashDevil Multiplayer — implementation-ready specification map](https://github.com/shivang991/DashDevil2D/issues/2)
**Labels:** wayfinder:research
**Status:** closed
**Assignee:** shivang
**Blocked by:** None

## Question

Using current primary sources, establish reliable WebTransport availability on keyboard-device browsers, secure-context/certificate and HTTP/3 requirements, practical Go server options alongside Fiber, hosting/reverse-proxy constraints, and whether reliable-stream ordering/head-of-line behavior fits gameplay input and snapshots. Compare WebSocket fallback feasibility. Separate established facts, limitations, and unknowns; do not select the product's browser matrix or transport. No implementation/prototype code.

## Resolution comment — 2026-10-11

Completed primary-source fact finding. WebTransport has a practical Go HTTP/3/QUIC implementation, but generic Fiber HTTP adapters cannot supply its QUIC connection context. Browser API availability does not prove reliable-stream interoperability; real browser/server compatibility remains to be validated. Reliable streams preserve ordering within a stream, not between players, and can delay newer state behind older queued bytes. WebSocket fallback is feasible but requires explicit application policy and validation.

The supported browser matrix, transport selection, hosting, queue policy and latency targets remain open human decisions. This resolution establishes feasibility facts, not a selected architecture or measured play quality.

Asset and detailed source citations: [Browser and Go transport feasibility findings](https://github.com/shivang991/DashDevil2D/blob/129e815ea4c462f3326aca7459dcfce09800cb94/research/transport-feasibility.md).

Context: throwaway branch `research/dashdevil-transport-feasibility`, pushed commit `129e815ea4c462f3326aca7459dcfce09800cb94`. One Markdown research file; no PR, merge or product code. Local research checkout: `/Users/shivang/.codex/worktrees/transport-research/claude-code-test`.

