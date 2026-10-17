# Standards review — #33

Reviewed `git diff ed23fe4...HEAD`, fixed point `ed23fe4c98fbbea7c5b72acc2b4fac4aac2690e8`, candidate `e1ab0b3` (`Implement swept Drag Race car contacts, returns and tailgating (#33)`). Read the supplied standards sources; no additional `CODING_STANDARDS.md`, `CONTRIBUTING.md` or `AGENTS.md` was found. Tooling-enforced rules were excluded.

## Documented standard violations

- **P2 — committed diagnostic log:** `docs/preservation/evidence/contacts/boundary-red.log:1` adds raw Vitest failure output (`RUN v5.0.4`, stack locations and durations). `docs/preservation/README.md:28` explicitly requires: “Future logs stay in ignored run folders or CI artifacts, not commits.” Move this log into a retained ignored run folder and link its location from the checkpoint/attempt summary. The existing compact Markdown explanation can remain committed.

## Judgement calls

No actionable baseline smell identified. The parallel Go/TypeScript algorithms implement the documented shared-mechanics parity boundary; their cross-language correspondence is not grounds for extracting a shared runtime abstraction.

Summary: 1 documented violation; 0 judgement-call findings. Worst Standards issue: committed raw diagnostic output contrary to preservation evidence policy.

## Disposition — 2026-10-17 America/Phoenix

Verified the working-tree correction: the committed-path log is deleted; the original bytes are preserved unchanged at ignored `apps/client/test-results/contacts-implementation/logs/boundary-red.log` (`git check-ignore` confirms exclusion). The checkpoint and attempt summary identify the retained ignored logs directory. Original finding resolved; 0 outstanding Standards findings.
