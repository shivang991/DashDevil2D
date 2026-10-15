# Server scaffold

This is a native Go module reserved for server coordination, authority and transport. Its `track` package implements generation version 1, with xorshift32 and Long Drive spawn-anchor fixtures shared with TypeScript; no listener or multiplayer behavior is implemented. `go vet ./...`, `go test ./...` and `go build ./...` are mandatory workspace checks now; the test command verifies exact seed words, cell flags, stable identities and canonical spawn times plus the agreed continuous-position tolerance. Full simulation/contact parity is not established.

Use Go 1.26.0 from `.go-version`, following [the operating-model decision](https://github.com/shivang991/DashDevil2D/issues/18#issuecomment-6147409056). Native authoritative simulation/parity arrives in #28 and secure transport in #29.

Protocol version 1 now provides generated binary contracts and handwritten wire-state/resource validation in `protocol/`. Native Go tests consume the same wire, continuation, CRC, projection and resource fixtures as TypeScript, alongside the existing seeded-track fixtures. Run `pnpm generate` and `pnpm check:generated` from the root after schema changes. Configuration capture/gameplay parity remain #28; endpoints and transport remain #29.

Stage 4/#29 now supplies a real secure transport diagnostic in `transport/` and executable `cmd/diagnostic` / `cmd/devcert` commands. See [transport setup, contracts and limitations](transport/README.md). This supersedes the scaffold-only listener statement above; full gameplay authority/parity still belongs to #28. Run `pnpm test:transport` from the root in addition to the existing checks.
