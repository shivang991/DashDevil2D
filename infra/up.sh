#!/bin/sh
# Run on the Docker host after DNS and inbound TCP 80/443 + UDP 443 are configured.
set -eu
allow_disruption=false
case "${1:-}" in
  '') ;;
  --allow-disruptive-upgrade) allow_disruption=true ;;
  *) echo "Usage: $0 [--allow-disruptive-upgrade]" >&2; exit 2 ;;
esac
[ "$#" -le 1 ] || { echo 'Too many arguments' >&2; exit 2; }
infra_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ ! -f "$infra_dir/.env" ]; then
  echo "Copy $infra_dir/.env.example to $infra_dir/.env and set PUBLIC_HOST and ACME_EMAIL first." >&2
  exit 1
fi
set -a
. "$infra_dir/.env"
set +a
: "${PUBLIC_HOST:?Set PUBLIC_HOST}"
: "${ACME_EMAIL:?Set ACME_EMAIL}"
case "$PUBLIC_HOST" in
  *[!a-zA-Z0-9.-]*|'') echo 'PUBLIC_HOST must be a DNS hostname without a scheme or port' >&2; exit 1 ;;
esac
compose() { docker compose --env-file "$infra_dir/.env" -f "$infra_dir/compose.yml" "$@"; }
compose config --quiet
compose build client server nginx
# Reject an unsafe supervisor timeout before touching the running deployment.
compose run --rm --no-deps --entrypoint /usr/local/bin/dashdevil-server server \
  --check-config --drain-timeout "${DRAIN_TIMEOUT:-3m}" --stop-grace-period "${STOP_GRACE_PERIOD:-200s}"
# Build first. Keep the running client/server revision together until rounds drain.
if [ -n "$(compose ps --status running -q server)" ]; then
  if ! compose exec -T server /usr/local/bin/dashdevil-server --request-drain --drain-timeout "${DRAIN_TIMEOUT:-3m}"; then
    if [ "$allow_disruption" != true ]; then
      echo 'Existing server could not drain. A pre-drain release needs a scheduled disruptive migration: rerun with --allow-disruptive-upgrade only when interruption is acceptable.' >&2
      exit 1
    fi
    echo 'Explicit disruptive upgrade: existing in-memory rooms will be lost.' >&2
  fi
  compose stop server
fi
# Avoid concurrent Certbot writers during provisioning/renewal.
compose stop certbot
# Existing images stay running until certificates are ready; fresh hosts bootstrap HTTP.
compose up -d --wait --wait-timeout 120 --no-recreate client nginx
compose run --rm --no-deps --entrypoint certbot certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --cert-name dashdevil --domain "$PUBLIC_HOST" --email "$ACME_EMAIL" \
  --agree-tos --non-interactive --keep-until-expiring
# Recreate even when build inputs are unchanged: the old process is drained.
compose up -d --wait --wait-timeout 120 --force-recreate client server nginx certbot
compose exec -T server /usr/local/bin/dashdevil-server --check-public --origin "https://$PUBLIC_HOST"
printf '\nDeployment ready: https://%s/\nTest create/join, play, results, rematch and recovery in two supported browsers.\n' "$PUBLIC_HOST"
