#!/bin/sh
set -eu
: "${PUBLIC_HOST:?PUBLIC_HOST must be set}"
case "$PUBLIC_HOST" in
  *[!a-zA-Z0-9.-]*|'') echo 'PUBLIC_HOST must be a DNS hostname without a scheme or port' >&2; exit 1 ;;
esac
envsubst '${PUBLIC_HOST}' < /etc/dashdevil/http.conf.template > /etc/nginx/conf.d/http.conf
if [ -s /etc/letsencrypt/live/dashdevil/fullchain.pem ] && [ -s /etc/letsencrypt/live/dashdevil/privkey.pem ]; then
  envsubst '${PUBLIC_HOST}' < /etc/dashdevil/default.conf.template > /etc/nginx/conf.d/default.conf
else
  # No dummy/self-signed certificate: start HTTP challenge handling only.
  cat > /etc/nginx/conf.d/default.conf <<'CONF'
server {
    listen 8081;
    server_name localhost;
    access_log off;
    location = /healthz { default_type text/plain; return 200 'ok\n'; }
    location / { return 404; }
}
CONF
fi
