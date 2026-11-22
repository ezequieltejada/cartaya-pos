#!/usr/bin/env bash
set -euo pipefail

SECRET_FILE="/workspaces/cartaya-pos/.secrets/tailscale"
HOSTNAME="cartaya-pos-dev"
DEV_SERVER_PORT=8100
LOG_FILE="/tmp/tailscale-up.log"
MAX_ATTEMPTS=5
DAEMON_WAIT_SECONDS=30

if [[ ! -f "$SECRET_FILE" ]]; then
  mkdir -p "$(dirname "$SECRET_FILE")"
  touch "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo "[tailscale] Created $SECRET_FILE. Add a Tailscale auth key to it and restart the container."
  exit 0
fi

AUTH_KEY="$(tr -d '[:space:]' <"$SECRET_FILE")"
if [[ -z "$AUTH_KEY" ]]; then
  echo "[tailscale] $SECRET_FILE is empty. Add a Tailscale auth key to it and restart the container."
  exit 0
fi

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Wait until tailscaled answers on its socket. `tailscale status` exits non-zero
# for "Logged out"/"NeedsLogin", so only treat "failed to connect to local
# tailscaled" as not ready.
wait_for_daemon() {
  local i out
  for ((i = 1; i <= DAEMON_WAIT_SECONDS; i++)); do
    out="$(tailscale status 2>&1 || true)"
    if [[ "$out" != *"failed to connect to local"* && "$out" != *"connect: no such file"* && "$out" != *"connection refused"* ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

connect() {
  local attempt
  log "Waiting for tailscaled (up to ${DAEMON_WAIT_SECONDS}s)..."
  if ! wait_for_daemon; then
    log "ERROR: tailscaled did not become ready."
    return 1
  fi

  for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
    log "tailscale up (attempt ${attempt}/${MAX_ATTEMPTS})..."
    # Needs root (or a prior `tailscale set --operator`). Redact the key from any error output.
    if sudo tailscale up --auth-key="${AUTH_KEY}" --hostname="${HOSTNAME}" --ssh 2>&1 | sed "s/${AUTH_KEY}/<redacted>/g"; [[ ${PIPESTATUS[0]} -eq 0 ]]; then
      sudo tailscale set --operator="$(id -un)" 2>&1 || true
      log "Connected. Starting tailscale serve on port ${DEV_SERVER_PORT}."
      sudo tailscale serve --bg "${DEV_SERVER_PORT}" 2>&1 || log "WARNING: tailscale serve failed."
      tailscale status 2>&1 || true
      return 0
    fi
    log "tailscale up failed; retrying in $((attempt * 3))s."
    sleep $((attempt * 3))
  done

  log "ERROR: tailscale up failed after ${MAX_ATTEMPTS} attempts. Check the auth key (expired/revoked/single-use?)."
  return 1
}

(connect) >"$LOG_FILE" 2>&1 &

echo "[tailscale] Starting in background as '${HOSTNAME}' (logs: ${LOG_FILE})."
