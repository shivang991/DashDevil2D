# Server scaffold

This is a native Go module reserved for server coordination, authority and transport. Its `track` package implements generation version 1, with xorshift32 and Long Drive spawn-anchor fixtures shared with TypeScript; no listener or multiplayer behavior is implemented. `go vet ./...`, `go test ./...` and `go build ./...` are mandatory workspace checks now; the test command verifies exact seed words, cell flags, stable identities and canonical spawn times plus the agreed continuous-position tolerance. Full simulation/contact parity is not established.

Use Go 1.26.0 from `.go-version`, following [the operating-model decision](https://github.com/shivang991/DashDevil2D/issues/18#issuecomment-6147409056). Native authoritative simulation/parity arrives in #28 and secure transport in #29.
