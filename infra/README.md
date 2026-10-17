# VPC transport test deployment

This packages the current Long Drive client and Stage 4 multiplayer transport diagnostic. It does not add gameplay authority or establish the remaining #29 browser/network acceptance requirements.

The three Dockerfiles build the client (Node 26.10.0/pnpm 8.15.9), native Go diagnostic server (Go 1.26.0), and nginx edge proxy. The client image includes only built static assets. The server build disables optional Git VCS stamping, so `.git` is not needed in the build context. The official Certbot 5.8.0 image handles automatic Let's Encrypt issuance and renewal.

## Before starting

Use a Linux host with Docker Engine, the Compose v2 plugin, and a DNS hostname you control. Point its A record at the host's public IPv4 address. Only publish an AAAA record if IPv6 ingress also reaches this host.

Allow these inbound ports in the host firewall, VPC security group and any network ACL/NAT rules:

| Public port | Destination | Purpose |
| --- | --- | --- |
| TCP 80 | nginx | Let's Encrypt HTTP-01 challenges and HTTPS redirect |
| TCP 443 | nginx | Client assets, HTTPS admission and room WebSocket |
| UDP 443 | Go server UDP 8443 | Real HTTP/3 WebTransport streams/datagrams |

Go TCP 8443 and client TCP 8080 remain private on the Compose bridge. Both public protocols use the same hostname, origin and certificate. nginx handles WebSocket upgrade headers; it does not pretend that a TCP proxy supplies HTTP/3. Browser WebTransport uses normal public certificate validation, with no development fingerprint or gameplay fallback.

A private-only VPC instance cannot complete public HTTP-01 validation as configured. Give the test host public ingress/forwarding, or adapt certificate issuance to a DNS-01 provider. A load balancer, CDN or DNS proxy in front must support the required UDP path; a normal HTTP-only reverse proxy is insufficient. Keep host TCP/UDP 443 aligned rather than remapping just one protocol to another public port.

## Start on the host

From the repository root:

```sh
cp infra/.env.example infra/.env
# Edit infra/.env: set PUBLIC_HOST and ACME_EMAIL.
./infra/up.sh
```

The helper:

1. Builds the three images using the lockfile and pinned toolchains.
2. Starts the client and nginx in HTTP-only challenge mode, without a dummy certificate.
3. Runs Certbot webroot issuance for `PUBLIC_HOST`, using `ACME_EMAIL` and Let's Encrypt's terms of service (`--agree-tos`).
4. Starts Go and the renewal service, then reloads nginx with HTTPS enabled.

Open `https://YOUR_HOST/` for Long Drive and `https://YOUR_HOST/transport.html` in two browsers for transport testing. Creating/joining a room must show two connected seats, increasing verification counts and the fixture positions `100.125, 20000.5`. Exercise dropping each channel, recovering the same seat, reloading, connected-pair replacement and requesting a fresh baseline. Record exact browser/OS versions and evidence for acceptance.

After initial provisioning, ordinary restarts/updates can use:

```sh
docker compose --env-file infra/.env -f infra/compose.yml up -d --build
docker compose --env-file infra/.env -f infra/compose.yml ps
docker compose --env-file infra/.env -f infra/compose.yml logs -f server certbot
```

Re-running `./infra/up.sh` reuses an existing certificate unless it is due for renewal. DNS and port 80 must remain available for renewal. Issuance failures leave the HTTP challenge service available; correct DNS/firewall settings and rerun the helper. Avoid repeatedly issuing fresh certificates while debugging, to respect CA rate limits.

## Certificates and renewal

`letsencrypt` and `acme-webroot` are persistent named volumes. The entire Let's Encrypt directory is mounted, preserving `live/` to `archive/` symlinks. Only Certbot writes certificates; nginx and Go mount them read-only. No keys, certificates, `.env`, host dependencies, Git metadata or diagnostic captures are included in build contexts.

Certbot checks renewal every 12 hours. nginx and Go poll certificate contents every 30 seconds: nginx validates/reloads its configuration, while Go restarts its listeners because the diagnostic currently loads certificates at startup. This Go restart clears in-memory rooms and invalidates their credentials; recreate diagnostic rooms after renewal. This is a testing setup, not a complete multiplayer maintenance/drain implementation. Both listener failures terminate the Go container, allowing Compose's restart policy to restart it empty.

To check the ACME renewal flow on the actual host without replacing the live certificate:

```sh
docker compose --env-file infra/.env -f infra/compose.yml run --rm --no-deps \
  --entrypoint certbot certbot renew --dry-run
```

Stop with `docker compose --env-file infra/.env -f infra/compose.yml down`. Keep the named certificate volumes; `down -v` removes the ACME account/certificates and forces reissuance. No Docker socket or cloud credentials are mounted into containers.

## Checks and limitations

Validate resolved configuration without a daemon:

```sh
PUBLIC_HOST=play.example.com docker compose -f infra/compose.yml config --quiet
sh -n infra/up.sh infra/nginx/start.sh infra/nginx/render-config.sh infra/server/start.sh
```

Container builds and the local certificate/bootstrap/transport smoke are recorded in `infra/VALIDATION.md`. Live public ACME issuance cannot be proven from a local fixture: it must pass on your host after DNS and ingress are configured. The current server is the stationary #29 diagnostic, not #28 gameplay parity or a completed multiplayer game.

References: [Compose interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/), [nginx WebSocket proxying](https://nginx.org/en/docs/http/websocket.html), [Certbot webroot validation](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot).
