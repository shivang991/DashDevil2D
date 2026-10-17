# Container verification — 2026-10-15

All three images built successfully using the checked-in lockfile/toolchains: client, Go server and nginx. The official pinned Certbot image ran and reported **5.8.0**. Tested runtime was **linux/arm64** in Docker Desktop **28.0.1** on Apple M2/macOS. [Structured record](validation.json) contains exact source hashes and built image identities.

Passed checks:

- `docker compose -f infra/compose.yml config --quiet` with an example PUBLIC_HOST, and `sh -n` for all four shell scripts.
- HTTP-only nginx bootstrap with an empty certificate volume: ACME challenge file served, normal paths redirected with HTTP 308, private health checks healthy.
- Certificate activation and `nginx -t`, HTTPS static client serving, real HTTPS admission through verified private upstream TLS.
- Native QUIC probe through **public UDP 443** to the Go container: HTTP/3 admission **200**, using normal TLS verification against the explicit local CA.
- Existing actual-Chrome transport suite: **3/3 scenarios passed, zero retries**, including two isolated seats, reliable streams/datagrams/verification, fresh baseline, both channel losses, same-seat recovery, reload/replacement and explicit error classifications.
- Simulated certificate renewal: nginx served the replacement certificate and Go automatically restarted its listeners within the polling window. Native UDP admission and all three Chrome scenarios passed again after renewal against the final nginx image.

The browser fixture used a temporary Chrome process with `--webtransport-developer-mode`, allowing the already-trusted **local** CA to satisfy WebTransport's extra public-known-root requirement. It did not disable ordinary certificate validation globally. This flag is not in the production Dockerfiles, Compose setup, client or host configuration. The initial unmodified-browser, IPv4-only and certificate-SPKI-only failures are retained. Native validation establishes the actual UDP routing; neither the flag nor local certificates establish public certificate/browser acceptance. [Chromium documents the known-root switch](https://chromium.googlesource.com/chromium/src/+/master/components/network_session_configurator/common/network_switch_list.h).

Evidence: `/private/tmp/dash29-infra-smoke/` (build log `/private/tmp/dash29-docker-build-01.log`, final nginx build `/private/tmp/dash29-nginx-build-final.log`). Browser traces were disabled to avoid recording seat credentials/ticket URLs; per-seat state/screenshots are embedded in the JSON report. Local private test keys are outside the repository/build context and are not committed. The isolated smoke project's containers and volumes are removed after verification.

**Not established locally:** actual public Let's Encrypt issuance or renewal dry-run, VPC firewall/DNS/NAT behavior, linux/amd64 runtime, the full supported-browser matrix or gameplay parity. Run `./infra/up.sh` on the configured public host to establish real ACME issuance. Existing Stage 4 acceptance limits remain in force.

## Deployment maintenance update — 2026-10-17

This update replaces the historical stationary-diagnostic deployment instructions with the playable app acceptance path. It adds private backend readiness, verified public HTTPS/admission/HTTP3 probes, planned maintenance for updates and certificate rotation, explicit disruptive migration opt-in, and protocol 2 so cached incompatible tabs reload. The earlier validation record above remains historical evidence.

The final local container smoke passed HTTP-only bootstrap, challenge serving and redirect, normal TLS verification against an explicit fixture CA, actual mapped TCP/UDP 18443 routing, non-public operator endpoints, completed drain/readiness failure, unchanged-image recreation, and certificate rotation with graceful Go restart. Rotation completed in 26.6 seconds. Safe default duration preflight passed; a 10-second supervisor grace was rejected before any listener/certificate setup. The isolated project and its volumes were removed. No live host was changed.

The forced workspace check passed all 15 tasks without cache, including typechecking, lint, 325 Vitest tests, Go tests/vet, generated-contract checks and builds. All 31 browser scenarios passed with zero failures, flakes or retries. Browser preservation commands and their exact reports are recorded in [the structured update](validation-2026-10-17.json). The maintenance scenario uses four isolated Chrome contexts and the shipped default Drag Race configuration: an earlier result stays immutable while another room continues playing, then abandons at the exact maintenance microsecond without a winner. Independent expectation review verified protocol fixture offsets and the browser's time/tick/position expectations. Visual inspection confirmed the explicit “Round abandoned / Server maintenance” result.

[Review record](review-2026-10-17.md): the independent Spec review found a late-Leave cutoff race, now fixed and covered by a deterministic regression with the periodic sweep held back. The independent Standards agent failed due an account usage limit; primary inspection and tooling results are recorded, without claiming a passing independent Standards review.

Raw logs, browser JSON/screenshots/video and image identities are retained under the ignored `apps/client/test-results/` tree. Failed fixture assumptions, old-version semantic tests and sandbox/listener attempts are retained alongside successful reruns. Fixture private keys stay outside the repository. Browser tests use process-scoped HTTPS SPKI and WebTransport certificate pins; container probes use a dedicated trusted local CA. Neither establishes production public-known-root browser acceptance.

Still requires the configured public host: actual ACME issuance/renewal dry-run, DNS/firewall/NAT/public 443 TCP+UDP, supported-browser/manual play acceptance, linux/amd64 and the wider operating-model reference hardware/network, capacity and observability evidence. The exact `up.sh` ACME flow was not run against a live domain.
