# Research browser and Go transport feasibility

Resolves the fact-finding question in the DashDevil multiplayer wayfinder map; researched 2026-10-11. This report does **not** select a transport, browser matrix, or hosting provider. No product code or prototype was written.

## Findings

### Keyboard-device browsers

The current MDN compatibility dataset records core WebTransport and bidirectional streams in Chrome 97+, Firefox 114+, and Safari 26.4+; Edge inherits Chromium support. Firefox's unidirectional-stream method is marked partial because it returns a `WritableStream` rather than the newer `WebTransportSendStream`. Advanced features have different support thresholds, so core availability does not establish parity for optional prioritization or statistics. [Maintained browser compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/WebTransport.json).

WebKit explicitly announced WebTransport in Safari 26.4. However, a Safari 26.4 report describes bidirectional stream creation hanging while datagrams work; Apple's response attributes it to system frameworks and moves tracking internally. The public issue's `RESOLVED INVALID` status therefore does **not** establish that this behavior was fixed. This is a reported interoperability risk, not a verified universal failure or a reason to exclude Safari automatically. [Safari announcement](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/), [vendor bug report and response](https://bugs.webkit.org/show_bug.cgi?id=312697).

**Implication:** the supported matrix must specify browser versions and prove actual stream connection/read/write behavior against the chosen server. Feature detection alone cannot establish network or protocol interoperability. This is inference from the sources, not a completed compatibility test.

### Secure context, certificates, and connection path

The W3C API is restricted to secure contexts. Normal server authentication uses a trusted TLS certificate matching the endpoint's hostname. The optional `serverCertificateHashes` mechanism substitutes certificate pinning: custom certificates must be valid now, have a validity period no longer than two weeks, and satisfy algorithm requirements (P-256 ECDSA is the interoperable default; RSA is disallowed for this mechanism). This short-lived restriction applies to custom hash authentication, not to ordinary CA-issued certificates generally. Streams carry bytes without preserving write boundaries, so the application needs framing. [W3C WebTransport specification](https://w3c.github.io/webtransport/).

The practical Go path inspected here establishes HTTP/3, then uses an Extended CONNECT request to open the session. Its server listens on UDP and supports explicit origin validation. [quic-go WebTransport server documentation](https://quic-go.net/docs/webtransport/server/).

**Implication:** production needs HTTPS for the page, appropriate TLS for the transport endpoint, and working UDP reachability. Local development requires a deliberate trusted-certificate or short-lived pinning arrangement; opening an HTTPS page alone does not solve endpoint certificate trust.

### Go server options beside Fiber

`github.com/quic-go/webtransport-go` is an actively released implementation built on quic-go. The README says it implements draft-16, so pinning and browser interoperability matter while protocol/API evolution continues. [Project README](https://github.com/quic-go/webtransport-go), [releases](https://github.com/quic-go/webtransport-go/releases).

At retrieval, the current main-branch module requires Go 1.26.0 and quic-go v0.62.0. These are observed main-branch requirements, **not** a recommendation to depend on main or a promise about every released tag. [Module manifest](https://github.com/quic-go/webtransport-go/blob/master/go.mod).

Current source defines `Server.H3` as `*http3.Server`, exposes `Upgrade(http.ResponseWriter, *http.Request)`, and requires QUIC connection context plus HTTP/3-specific response interfaces. It also configures HTTP/3 settings and datagram support. These details differ from older examples that embed a value `http3.Server`; copying an old tutorial verbatim can therefore fail. [Current server source](https://github.com/quic-go/webtransport-go/blob/master/server.go).

Fiber supplies `net/http` adapters, but handler conversion is not protocol conversion. [Fiber adaptor documentation](https://docs.gofiber.io/middleware/adaptor/).

**Inference:** a practical arrangement is a real WebTransport/HTTP3 listener beside Fiber's ordinary HTTP service, sharing the application's session/game services. A generic Fiber HTTP adapter cannot manufacture the QUIC context or HTTP/3 writer interfaces required by `Upgrade`. Whether Fiber remains necessary, and whether services share one process, are architecture decisions still open. No integration was compiled or exercised.

### Hosting and reverse proxies

quic-go documents UDP listening and L4 reverse proxies, including a separate external UDP port. [HTTP/3 serving documentation](https://quic-go.net/docs/http3/server/).

**Inference:** direct UDP exposure or QUIC-preserving L4 forwarding is the simplest clearly documented path. A normal HTTP reverse proxy that terminates HTTP/3 and forwards HTTP/1.1 or HTTP/2 to Fiber does not preserve the Go server's QUIC session. Advertising “HTTP/3 support” at a CDN/load balancer does not prove WebTransport Extended CONNECT and stream forwarding. A WebTransport-aware terminating proxy could work, but would need explicit provider support and an appropriate upstream implementation; none is established here.

Before selecting a host, verify public UDP ingress, certificates, supported WebTransport draft/settings, idle timeouts, connection affinity, and whether the origin remains reachable when the edge terminates HTTP/3. No host has been selected, so provider feasibility remains unknown.

### Reliable streams, ordering, and pressure

QUIC avoids head-of-line blocking **between** independent streams; loss still blocks affected streams until retransmission. Streams sharing a lost packet can both stall. This does not remove congestion or flow-control limits. [RFC 9000, sections 2, 4 and 13](https://www.rfc-editor.org/rfc/rfc9000.html).

Stream resets can stop retransmission and terminate a stream, but that is a stream-level cancellation mechanism, not arbitrary deletion of an already queued message within an ongoing byte stream. [quic-go streams documentation](https://quic-go.net/docs/quic/streams/).

**Inference for DashDevil:** reliable ordering can preserve discrete inputs/control events within a client's stream, but it creates no universal order across the two clients' independent connections. Road Rage's “second-to-last input” collision rule still requires an authoritative server ordering policy. A continuously queued snapshot stream can force new snapshots to wait for obsolete bytes. Separate streams can isolate some traffic classes, but a queue bound/coalescing policy, sequence/tick identifiers, disconnect deadline, and latency acceptance criteria remain necessary. No transport guarantees a particular gameplay latency without measurements.

### WebSocket fallback feasibility

WebSocket is widely available, message-framed, and built over TCP. [WebSocket protocol specification](https://www.rfc-editor.org/rfc/rfc6455.html), [browser API documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).

Fiber has a WebSocket integration based on fasthttp WebSocket; its current documentation targets Fiber v3 and `github.com/gofiber/contrib/v3/websocket`. A chosen Fiber major version must match its integration package. [Fiber WebSocket documentation](https://docs.gofiber.io/contrib/websocket/).

The ordinary browser WebSocket API does not supply automatic receive backpressure; `bufferedAmount` exposes queued outgoing bytes. [WebSocket browser API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).

**Inference:** an application-level fallback over secure WebSocket is technically plausible and usually fits ordinary TCP/HTTP upgrade hosting. It needs explicit connection failure/timeout handling, bounded queues, a common message model, and its own acceptance tests. It cannot reproduce independent QUIC streams or unreliable datagrams transparently. TCP loss can delay newer messages behind older data. No automatic WebTransport-to-WebSocket fallback is established by these sources.

## Decisions still needed

- Supported browser/version matrix, and the treatment of unsupported or failing transport connections.
- WebTransport-only, WebSocket-only, or application-level fallback; no selection is made here.
- Hosting topology and whether its actual ingress supports the selected protocol.
- Which gameplay messages require every event versus only the newest state; framing, queues, and authority ordering.
- Version-pinned Go/Fiber/transport dependencies and real-browser interoperability validation criteria.

The evidence establishes feasible building blocks, not a latency benchmark or deployment proof. Sources on mutable main branches and browser tables should be rechecked when implementation versions are pinned.
