#!/bin/sh
set -eu
fingerprint() {
  cat /run/tls/live/dashdevil/fullchain.pem /run/tls/live/dashdevil/privkey.pem | sha256sum
}
child=''
watcher=''
shutdown() {
  trap - TERM INT
  [ -z "$watcher" ] || kill "$watcher" 2>/dev/null || true
  [ -z "$child" ] || kill -TERM "$child" 2>/dev/null || true
  [ -z "$child" ] || wait "$child" || true
  exit 0
}
trap shutdown TERM INT
while :; do
  previous=$(fingerprint)
  /usr/local/bin/dashdevil-server "$@" &
  child=$!
  (
    while sleep 30; do
      if [ "$(fingerprint)" != "$previous" ]; then
        # Keep the currently loaded certificate serving while rounds drain.
        # A failed drain must not turn renewal into an abrupt restart.
        if /usr/local/bin/dashdevil-server --request-drain "$@"; then
          kill -TERM "$child" 2>/dev/null || true
          exit 0
        fi
        echo 'Certificate changed but maintenance drain failed; keeping current listeners' >&2
      fi
    done
  ) &
  watcher=$!
  result=0
  wait "$child" || result=$?
  kill "$watcher" 2>/dev/null || true
  wait "$watcher" 2>/dev/null || true
  if [ "$(fingerprint)" = "$previous" ]; then
    # A listener/process failure must fail the container, not leave half a service.
    exit "$result"
  fi
  echo 'TLS certificate changed; restarting Go listeners' >&2
done
