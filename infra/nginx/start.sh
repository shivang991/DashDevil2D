#!/bin/sh
set -eu
fingerprint() {
  if [ -s /etc/letsencrypt/live/dashdevil/fullchain.pem ] && [ -s /etc/letsencrypt/live/dashdevil/privkey.pem ]; then
    cat /etc/letsencrypt/live/dashdevil/fullchain.pem /etc/letsencrypt/live/dashdevil/privkey.pem | sha256sum
  else
    printf 'pending'
  fi
}
/usr/local/bin/render-config
(
  previous=$(fingerprint)
  while sleep 30; do
    current=$(fingerprint)
    if [ "$current" != "$previous" ]; then
      if /usr/local/bin/render-config && nginx -t && nginx -s reload; then
        previous=$current
      fi
    fi
  done
) &
exec nginx -g 'daemon off;'
