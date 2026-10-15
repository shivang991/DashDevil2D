#!/bin/sh
# Run on the Docker host after DNS and inbound TCP 80/443 + UDP 443 are configured.
set -eu
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
# nginx starts in HTTP-only challenge mode when no certificate exists.
compose up -d --wait client nginx
compose run --rm --no-deps --entrypoint certbot certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --cert-name dashdevil --domain "$PUBLIC_HOST" --email "$ACME_EMAIL" \
  --agree-tos --non-interactive --keep-until-expiring
compose up -d server certbot
compose exec -T nginx sh -c '/usr/local/bin/render-config && nginx -t && nginx -s reload'
printf '\nOpen https://%s/transport.html in two browsers.\n' "$PUBLIC_HOST"
