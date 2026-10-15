# Independent review of #27

Fixed point: `3c609c91e8c7d883c446d9a71eb4051680bfae48`. Initial implementation commit `95d6908`. Two independent agents applied `.agents/skills/code-review/SKILL.md` against that fixed point and rechecked the repair delta. Fixture expectations were checked independently of the production codecs. Full original reports and failed/passing targeted outputs remain in the task transcript and `/private/tmp/dashdevil-stage3-evidence/contracts/`.

## Standards

Initial P1: TypeScript TextDecoder stripped a leading U+FEFF, while native Go preserved it. This violated exact compatible UTF-8 content. Fixed with `ignoreBOM: true`; shared leading-BOM and BOM-only vectors prove exact bytes and decoded strings in both languages. Original red run retained.

Final report: “No outstanding Standards findings. The leading U+FEFF compatibility defect is fixed: TypeScript now uses `ignoreBOM: true`, with its DOM-free constructor declaration updated. Shared leading-BOM and BOM-only fixtures assert exact bytes and decoded values through both languages’ public APIs. … No further documented-standard violations, actionable baseline smells, or concrete correctness issues found.”

## Spec

Initial P2: Baseline validation bounded the current car position but could install a shifting car with an out-of-world movement destination. Fixed in both languages by bounding movement origins/targets and requiring the shift origin/destination and return destination to agree with their lanes. Normal speed also respects captured minimum normal speed. Four shared invalid-continuation cases were independently reviewed and tested red before repair.

Final report: “Spec re-review: 0 outstanding findings. The P2 movement continuation issue is resolved consistently in Go and TypeScript. Independent review confirmed all four new invalid fixtures violate the settled lane geometry: out-of-world origin/target, incorrect shift destination, and incorrect return destination. Public API probes reject each fixture while accepting the original baseline. BOM fixtures preserve literal UTF-8 `efbbbf`, including a BOM-only string. No new actionable Spec issues or scope creep found in the repair delta.”

The Spec reviewer independently checked literal ten-byte datagrams, packed-car bytes, projection CRC using the normal polynomial with explicit reflection, and resource enclosure/count expectations. Human audiovisual review, Go simulation parity and real transport are not established by these reviews.

Summary: Standards **0 outstanding** (original P1 resolved); Spec **0 outstanding** (original P2 resolved).
