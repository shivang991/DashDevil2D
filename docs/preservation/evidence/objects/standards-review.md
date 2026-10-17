# Standards review — issue #32

Reviewed commit `25901b4` against fixed point `8f64dfeaad762039ea410b5cc54186a14d72f9d9` using `git diff 8f64dfeaad762039ea410b5cc54186a14d72f9d9...HEAD`, plus the working-tree addition of context/object diagnostics to `MultiplayerScreen.tsx`.

Final incremental review includes `f8d1d5c`, `bb64af2` and `ab1f814`: added contested-pickup/finish-precedence expectations, deterministic browser lane presses, visible-object screenshot attachments and browser-harness routing. No additional findings. Excluding `objects.spec.ts` from the HTTP preservation configuration is consistent with its required secure real-transport setup; it remains selected by the dedicated transport configuration when `DASHDEVIL_OBJECT_TESTS` is set. Main-run reports identify passing `pnpm test:objects` and `pnpm test:hearts`. The initially misrouted run is retained as failed evidence; its twelve existing preservation scenarios passed, while the new scenario failed under the wrong harness. These results are supplied by the main run, not independently rerun here.

## Documented standards

No documented-standard breaches found. Sources inspected: the empty `CLAUDE.md`, `GLOSSARY.md`, root README, client/server/transport READMEs, contracts and protocol READMEs, infrastructure README and preservation README. No AGENTS, CONTRIBUTING or CODING_STANDARDS file was found. Tooling-enforced formatting/type rules were excluded from this review.

The change preserves simulation ownership of interaction state, copies authoritative car/object state into client continuation, keeps final outcomes authoritative, uses shared Go/TypeScript fixtures and respects separate per-seat obstacle consumption versus shared pickup consumption. Independent expected fixture review remains the other review axis's responsibility.

## Optional heuristic finding

**[P3] Possible Duplicated Code / Primitive Obsession:** `RaceSession.ts:97–102`, `RaceView.tsx:61–65` and `multiplayer.ts` repeatedly decode object flags using `flags & 3` and `kind === 2 ? 8 << seat : 4`, then repeat kind-dependent sizes/names. A small shared TypeScript object-kind/consumption helper would make the gameplay interpretation explicit and reduce the chance that rendering, feedback and simulation diverge when flags evolve. This is a judgement call, not a documented violation or correctness blocker. Cross-language Go/TypeScript implementations are intentional parity owners and should remain separately implemented.

## Correctness inspection and validation

No confirmed new correctness defects found. Particular attention went to mid-tick authoritative events, resuming an engine from a non-tick canonical time, retaining consumption during pending-input replay, authoritative reversal of provisional death, rejecting older same-tick baselines and suppressing duplicate feedback. Expanded-coverage admission was checked against the protocol README's complete mutable-window rule; represented objects are supplied to the restored client engine rather than regenerated with assumed availability.

Focused validation: `pnpm --filter @dashdevil/client exec vitest run tests/session/race.test.ts tests/simulation/objects.test.ts` passed **22 tests in 2 files**. No generation or product-source mutation was performed. Real-transport/browser evidence and the full workspace suite are owned by the main implementation run; these focused tests do not establish those gates.
