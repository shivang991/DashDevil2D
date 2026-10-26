# Deploy DashDevil

This deploys the current Long Drive client and playable Drag Race rooms, including results, rematches and recovery. Product rooms are the default; `transport.html` is a retained developer diagnostic and is not the deployment acceptance path.

The client uses Node 26.10.0/pnpm 8.15.9 at build time; the native Go server uses Go 1.26.0. nginx serves built assets and proxies HTTPS admission/room WebSockets. The same Go process owns authoritative rooms and the direct HTTP/3 WebTransport listener. Certbot 5.8.0 issues/renews the public certificate. Protocol 2 adds explicit maintenance abandonment; older tabs must reload and are rejected with a version mismatch before admission.

## Host requirements

Use a Linux Docker host with Compose v2 supporting `up --wait`. Point `PUBLIC_HOST` DNS at this host. Publish AAAA only when IPv6 ingress reaches it. Allow TCP **80**, TCP **443** and UDP **443** through every firewall/security group/NAT. TCP 80 is required for ACME HTTP-01; TCP 443 serves the app and room channel; UDP 443 maps directly to Go UDP 8443. Backend TCP 8443/client TCP 8080 are bridge-only. Operator HTTP is **127.0.0.1:8082 inside the server container**, with no published port or nginx route.

The public hostname, client origin and certificate must agree. Use normal public certificate validation; no development fingerprint or fallback transport is installed. An HTTP-only CDN/load balancer does not provide the required UDP path. Private-only hosts need a different issuance arrangement such as DNS-01; this script uses public HTTP-01.

On the Linux host, permit the UDP buffers [recommended by quic-go](https://github.com/quic-go/quic-go/wiki/UDP-Buffer-Sizes) before starting the server:

```sh
sudo install -m 644 infra/quic.conf /etc/sysctl.d/60-dashdevil-quic.conf
sudo sysctl -p /etc/sysctl.d/60-dashdevil-quic.conf
```

Check an existing file before replacing it. These are host socket-buffer ceilings, not per-player allocations or application timeout changes. Restart the server through the normal drain/deployment flow to resize existing sockets. Preserve the previous values for rollback. The #44 VPS test eliminated observed kernel UDP receive drops after this change; it still failed sustained-load acceptance. See [the load checkpoint](../docs/preservation/load-checkpoint.md).

## First deployment and updates

From the repository root on the Docker host:

```sh
cp infra/.env.example infra/.env
# Set PUBLIC_HOST and ACME_EMAIL; keep this file private.
./infra/up.sh
```

For later updates, pull the desired revision and run **the same `./infra/up.sh`**. It:

1. Validates Compose and builds images before interrupting the running revision.
2. Requests maintenance from an existing server and waits for it to drain, then stops it. Existing client/nginx containers stay on their old images until this completes.
3. Stops the renewal service to avoid competing certificate writers; starts missing client/nginx services in HTTP challenge mode without recreating existing ones.
4. Issues/reuses the certificate. Then recreates the services together, waits for client/nginx health and server readiness, and restarts renewal.
5. Probes public HTTPS assets, binary admission/version routing and real HTTP/3 UDP reachability using normal TLS. It prints `Deployment ready` only after these checks succeed.

The public probes allocate no room. They prove deployment routing/listener reachability, not WebTransport browser interoperability or a complete playtest. Open **`https://YOUR_HOST/`** in two supported browsers and verify create/join, Ready, countdown, the default Drag Race course, matching results, Return to Lobby/rematch and recovery before grace. Retain actual versions, screenshots and logs for host acceptance.

Do not use a bare `docker compose up -d --build` as an update procedure: it can replace client assets or kill the server while rounds are active. For a simple planned stop, use `docker compose --env-file infra/.env -f infra/compose.yml stop`; the server drains on SIGTERM. `down` additionally removes containers/networks. Avoid `down -v`, which deletes ACME accounts/certificates and forces issuance again.

### Migrating an older deployed server

The original Stage 4/5 deployment has no operator/drain API. The helper refuses to silently interrupt that release. Schedule a maintenance window, ensure losing its in-memory rooms is acceptable, then run once:

```sh
./infra/up.sh --allow-disruptive-upgrade
```

The flag permits proceeding if the existing server cannot drain; it does not bypass build, certificate, readiness or public probe failures. Future deployments use normal draining. Reload old tabs after the protocol-2 deployment.

## Maintenance and certificates

`DRAIN_TIMEOUT` defaults to **3m**. Maintenance immediately stops new room creation, joining and round starts, and cancels countdowns into the lobby. Existing seats may reconnect while active rounds continue. At the deadline, gameplay through the exact boundary is resolved first; unfinished rounds are abandoned without a winner with the explicit maintenance reason. Already-confirmed results remain unchanged. One application-progress window is allowed for notification, then all rooms/credentials are closed. Restarted processes begin empty.

`STOP_GRACE_PERIOD` defaults to **200s** and must exceed `DRAIN_TIMEOUT` by at least 15 seconds; change both together for a longer drain. Drain durations use whole microseconds and must be at least 1 ms. A listener/process crash still fails the container and restarts empty; a crash cannot promise graceful notification.

The entire persistent Let's Encrypt directory is mounted read-only in nginx/Go, preserving `live/` → `archive/` links. Certbot is the only certificate writer and checks every 12 hours. nginx polls every 30 seconds and validates/reloads certificates. Go's watcher detects changed certificate contents, requests maintenance, then restarts listeners only after the drain completes. The old loaded certificate remains in service while rounds finish. A drain failure leaves the existing listeners running and logs the problem rather than forcibly interrupting rounds.

Certificate renewal and planned updates close all rooms after draining. Reconnect credentials do not survive restart. No Docker socket or cloud credentials are mounted inside services. Public health/metrics routes are not enabled.

## Operator commands and verification

```sh
# Container/process readiness; returns nonzero during maintenance.
docker compose --env-file infra/.env -f infra/compose.yml exec -T server \
  /usr/local/bin/dashdevil-server --check-ready

# Enter maintenance and wait for all rooms to close (use the configured timeout).
docker compose --env-file infra/.env -f infra/compose.yml exec -T server \
  /usr/local/bin/dashdevil-server --request-drain --drain-timeout 3m

# Public HTTPS/admission/HTTP3 probe, from the running container.
docker compose --env-file infra/.env -f infra/compose.yml exec -T server \
  /usr/local/bin/dashdevil-server --check-public --origin https://YOUR_HOST

# CA renewal validation on the configured public host.
docker compose --env-file infra/.env -f infra/compose.yml run --rm --no-deps \
  --entrypoint certbot certbot renew --dry-run
```

A drained process remains unavailable for new play; use `up.sh` to restart/redeploy it. Inspect `docker compose --env-file infra/.env -f infra/compose.yml ps` and `logs server nginx certbot` on failure. If issuance fails after a planned drain, the old server is stopped and the HTTP challenge service remains available; correct DNS/firewall/CA errors and rerun. A failed public probe leaves containers available for inspection and exits nonzero; it does not assert deployment success or roll back automatically.

Run local static checks with:

```sh
PUBLIC_HOST=play.example.com docker compose --env-file /dev/null -f infra/compose.yml config --quiet
sh -n infra/up.sh infra/server/start.sh infra/nginx/start.sh infra/nginx/render-config.sh
pnpm check
pnpm test:maintenance
```

Maintenance coverage is required in CI alongside existing preservation/transport suites. [Validation history](VALIDATION.md) distinguishes local fixtures from actual public ACME, VPC/firewall, supported-browser, reference-hardware/network, capacity and human acceptance. The operating model also requires wider observability and capacity evidence; this deployment update does not claim full production acceptance.

Governing [operating model](https://github.com/shivang991/DashDevil2D/issues/18#issuecomment-6147409056), [verification](https://github.com/shivang991/DashDevil2D/issues/17#issuecomment-6147257139) and [stage sequence](https://github.com/shivang991/DashDevil2D/issues/20#issuecomment-6147982401).
