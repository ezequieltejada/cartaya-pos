---
name: agent-browser
description: Drive the host's real Chromium from the devcontainer with agent-browser (CLI or MCP) to inspect, test and debug the POS app and web app: open pages, snapshot, click/fill, read network requests and console logs.
---

# Using agent-browser against the host's Chromium

## When to use
- Verifying a UI change in the running app, reproducing a bug, or checking failing API calls.
- Anything that needs a real browser session (including the user's logged-in tabs).

## Setup (already automated)
`.devcontainer/setup-agent-browser.sh` runs on every container start. It installs the CLI,
writes `~/.agent-browser/config.json` with the host's CDP URL, and registers the MCP server
(`claude mcp add agent-browser -- agent-browser mcp`).

**Do not install a browser in the container.** It is Linux ARM64 and Chrome for Testing has no
build for it, so `agent-browser install` fails. Use the Chromium already running on the host
with remote debugging on port 9222.

### Host IP, not a hostname
Chrome rejects the `Host` header unless it is `localhost` or an IP, so `localhost` and
`host.docker.internal` both fail. Resolve the IP and check:
```bash
ip=$(getent hosts host.docker.internal | awk '{print $1}')
curl -s http://$ip:9222/json/version        # should print browser version JSON
agent-browser --cdp http://$ip:9222 get url
```
The IP can change when the container network changes. If connections fail, re-run
`bash .devcontainer/setup-agent-browser.sh` (it re-resolves and rewrites the config), or edit
`~/.agent-browser/config.json`:
```json
{"cdp": "http://<ip>:9222"}
```
If the host browser does not answer, it must be started with `--remote-debugging-port=9222`.

## Before the first command
Run `agent-browser skills get core` for the usage guide matching the installed version.

## Sessions
Use your own session name on every command (CLI) or as the `session` argument (MCP tools):
```bash
S=$(agent-browser session id --scope worktree --prefix task)
agent-browser --session $S <command>
```
Each command may run in a new shell, so an exported variable will not carry over; re-derive it.

## Work loop
`open <url>` → `snapshot -i` → act on `@eN` refs (`click`, `fill`, `select`, `check`) →
snapshot again after any page change. Refs are invalidated by navigation and tab switches, so
re-snapshot first. `Unknown ref` means exactly that.

## Tabs (these are the user's real tabs)
- `tab list` shows them, e.g. `t1` POS app, `t2` web app.
- `tab t2` switches.
- Check `get url` before navigating so you don't navigate away from a page the user left open.

## Useful commands
`get text body`, `get url`, `network requests` (failing API calls, status codes), `console`
(page logs), `screenshot <path>`, `wait <ms>` / `wait --text "..."`, `find text "..." click`
(when there is no ref).

## Targets
- Web app (dev): `https://cartaya-webapp-dev.tailbc95f3.ts.net`
- Web app API: `https://cartaya-api-dev.tailbc95f3.ts.net`
- POS app (dev server, port 8100): served from this container over Tailscale at
  `https://cartaya-pos-dev.tailbc95f3.ts.net`. `http://localhost:8100` is a host-side address
  and cannot be reached from the container.

## MCP profile
The MCP server exposes only the `core` tool profile by default. For network/console tooling,
register it with extra profiles, e.g. `agent-browser mcp --tools core,network,debug`.
