# Admission-operation pilot — human review

Issue: https://github.com/shivang991/DashDevil2D/issues/52
Baseline: `19c5014d43c8a40e9d339143ea55387d57012be2`.

## Proposed naming and schema

Only admission operations participate. Room commands and other numeric domains
remain unchanged. The canonical `protocol/schema.json` entry is:

```json
"admissionOperation": { "create": 0, "join": 1, "resume": 2 }
```

`AdmissionRequest.operation` declares `{ "type": "u8", "enum": "admissionOperation" }`.
The generator derives the existing maximum of 2. Explicit contiguous assignments
are checked at generation time; legacy name arrays are ignored. This deliberately
does not claim support for sparse enums or other scalar widths.

Generated TypeScript API:

```ts
export const AdmissionOperationCreate = 0;
export const AdmissionOperationJoin = 1;
export const AdmissionOperationResume = 2;
export type AdmissionOperation =
  typeof AdmissionOperationCreate | typeof AdmissionOperationJoin | typeof AdmissionOperationResume;
// AdmissionRequest.operation: AdmissionOperation
```

Generated Go API:

```go
type AdmissionOperation uint8
const (
    AdmissionOperationCreate AdmissionOperation = 0
    AdmissionOperationJoin AdmissionOperation = 1
    AdmissionOperationResume AdmissionOperation = 2
)
// AdmissionRequest.Operation AdmissionOperation
```

Caller examples: `actions.connect(AdmissionOperationCreate, "", selectedMode)`,
`connection.connect(AdmissionOperationJoin, code.value)`,
`this.connect(AdmissionOperationResume)`, and
`case p.AdmissionOperationCreate, p.AdmissionOperationJoin:`.
Semantic validation, diagnostic admission, tests and the join story use these names.
No protocol version, framing, numeric values or existing literal fixtures changed.

## Actual production JavaScript

Built with installed Vite 7.3.1 using the repository's production config, including
both main and diagnostic transport entry points. Baseline build used production
TS sources from the baseline above with the same dependencies/configuration;
changed sources were restored immediately afterward. Commands:

```sh
pnpm --filter @dashdevil/client exec vite build --outDir /tmp/issue52-baseline
pnpm --filter @dashdevil/client build
```

Inspected minified artifacts, rather than assuming cross-module const-enum inlining.
The shared `PairedConnection-DJi_2P1N.js` contains:

```js
const A = 3,
  Y = 0,
  $e = 1,
  P = 2,
  E = {/* existing layouts */};
// Inside connect:
const s = this.generation,
  a = e === P ? this.state : void 0;
// pending:
e === Y ? "Creating room" : e === $e ? "Joining room" : "Recovering room";
// exports include:
export { Y as A, /* existing exports */ $e as i, P as j /* existing exports */ };
```

The main bundle uses `p?.connect(t0,"",h)` with the scalar imported from the shared
chunk. The diagnostic entry likewise imports scalar bindings. No runtime enum
object, reverse mapping, property lookup table or remote configuration is added.
TypeScript's union erases. Go constants have no runtime lookup or allocation.

**JavaScript is not strictly zero overhead.** The production bundler retains three
scalar bindings, comparisons/calls reference them, and chunks import/export them.
No timing benchmark was performed; this is emitted-code and size evidence only.
Minifier names/hashes can change on rebuild.

| JS artifact      | Baseline raw bytes | Pilot raw bytes | Delta |
| ---------------- | -----------------: | --------------: | ----: |
| PairedConnection |             103940 |          103984 |   +44 |
| main             |             318756 |          318783 |   +27 |
| transport        |               1257 |            1278 |   +21 |
| Total            |             423953 |          424045 |   +92 |

Sum of independently gzipped chunks (Python `gzip.compress`, `mtime=0`):
130496 → 130563 bytes, **+67 bytes**. Hash churn and minifier renaming contribute
to the measured delta; it is the actual whole-build difference, not a theoretical
per-constant byte cost.

Pilot shared-chunk SHA-256:
`198f599d08254174b53b3d4f0b77f13621665b9234c06f31b91f38cc0127f559`.
Baseline shared-chunk SHA-256:
`81a31f41d68c88b9133c9237fc149c48afac0a211cd2fc73dd512610a86ce714`.

## Validation and approval

Tests exercise named create/join/resume operations against independent literal
wire vectors, codec rejection of operation 3, and HTTP admission rejection of a
manually framed operation 3. Existing admission lifecycle tests cover real create,
join and resume behavior. Existing protocol JSON byte fixtures remain untouched.
The new named-API TS cases fail against the original generated module (missing
named exports) and pass with regenerated output.

Human decision required: approve naming, schema association, generated APIs,
caller readability and the measured small JS overhead before reusing this approach
for remaining domains. Implementation/checks alone do not authorize that expansion.
Record explicit human approval on issue #52 or its linked PR before closing it.

Validation result: `pnpm check` passed (generated-output checks, TypeScript checks,
Go vet, lint, all Go packages, 550 client tests across 24 files, production builds).
Targeted Go named-operation wire and HTTP invalid-operation tests also passed.
