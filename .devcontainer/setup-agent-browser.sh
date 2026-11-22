#!/usr/bin/env bash
# Sets up agent-browser inside the devcontainer, driving the HOST's Chromium over CDP
# (the container is Linux ARM64 and has no usable browser of its own).
# Idempotent: safe to run on every container start. Never fails the container start.
set -uo pipefail

CDP_PORT=9222
CONFIG_DIR="$HOME/.agent-browser"
CONFIG_FILE="$CONFIG_DIR/config.json"

log() { echo "[agent-browser] $*"; }

if ! command -v agent-browser >/dev/null 2>&1; then
  log "Installing agent-browser CLI..."
  npm install -g agent-browser >/dev/null 2>&1 || { log "npm install failed; skipping."; exit 0; }
fi

# Chrome rejects non-IP, non-localhost Host headers, so resolve to an IP.
HOST_IP="$(getent hosts host.docker.internal | awk '{print $1}' | head -n1)"
if [[ -z "$HOST_IP" ]]; then
  log "Could not resolve host.docker.internal; leaving config untouched."
else
  mkdir -p "$CONFIG_DIR"
  printf '{"cdp": "http://%s:%s"}\n' "$HOST_IP" "$CDP_PORT" >"$CONFIG_FILE"
  if curl -s -m 3 "http://${HOST_IP}:${CDP_PORT}/json/version" >/dev/null; then
    log "Host browser reachable at ${HOST_IP}:${CDP_PORT}."
  else
    log "Config written (${HOST_IP}:${CDP_PORT}) but the host browser isn't answering."
    log "Start Chromium on the host with --remote-debugging-port=${CDP_PORT}."
  fi
fi

if command -v claude >/dev/null 2>&1; then
  if ! claude mcp get agent-browser >/dev/null 2>&1; then
    claude mcp add agent-browser -- agent-browser mcp >/dev/null 2>&1 \
      && log "Registered MCP server with Claude Code." \
      || log "Could not register MCP server with Claude Code."
  fi
fi

exit 0
