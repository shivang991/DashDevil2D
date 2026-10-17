## Standards

No remaining documented-standard breaches or actionable baseline smells found. The duplicated capped-speed integration now uses one helper per language. The original late-Disposition and keyboard-focus findings are addressed.

## Material correctness

**[P2] Defer terminal acknowledgement during an in-flight same-round recovery** — `apps/client/src/transport/PairedConnection.ts`, `ackOutcome()`. This checks only whether a baseline exists. `requestBaseline()` retains the old baseline while setting `recoveryOutstanding`; the server processes Recovery by replacing its baseline epoch and setting `installed=false`. If Outcome overtakes the replacement authority-stream chunks, the client immediately acknowledges using the retained old epoch, and the server rejects it as `authority acknowledgement context`. The later Ready-path acknowledgement cannot repair the already-closed pair. Defer `ackOutcome()` while recovery/transfer is outstanding, then acknowledge after replacement Ready. The existing no-baseline case is handled, but retained-old-baseline recovery needs equivalent coverage.

Scope of review: incremental `git diff 6f83763..6717546`, with surrounding outcome/recovery handlers inspected. No edits to product source or tests.
