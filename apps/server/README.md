# Native server and transport diagnostic

This Go module contains deterministic track generation, generated binary protocol contracts, handwritten wire-state/resource validation, and the Stage 4 secure transport diagnostic. Full gameplay authority, configuration capture semantics and movement/contact parity remain #28 work.

Use Go 1.26.0 from `.go-version`, following the [operating-model decision](https://github.com/shivang991/DashDevil2D/issues/18#issuecomment-6147409056). `go vet ./...`, `go test ./...` and `go build ./...` are mandatory workspace checks. Native tests consume the same seed/track, wire, continuation, CRC/projection and resource fixtures as TypeScript. Run `pnpm generate` and `pnpm check:generated` from the root after schema changes.

Stage 4/#29 supplies real HTTPS/WebSocket and HTTP/3 UDP listeners in `transport/`, with executable `cmd/diagnostic` and `cmd/devcert` commands. See [transport setup, contracts and limitations](transport/README.md). Run `pnpm test:transport` from the root in addition to the existing checks. The diagnostic fixture does not start multiplayer gameplay; Stage 4 exit still requires #28 parity and the applicable supported-browser/certificate evidence.
