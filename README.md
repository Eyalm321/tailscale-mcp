# Tailscale MCP Server

A Bun-based [Model Context Protocol](https://modelcontextprotocol.io/) server
for operating Tailscale from MCP clients.

It supports local `stdio` usage for desktop clients and an authenticated HTTP
transport for private tailnet deployments. The server defaults to read-only
access, localhost binding, and short-lived OAuth credentials where available.

## Features

- Tailscale device, route, DNS, ACL, key, webhook, exit-node, and tag management.
- Read-only MCP resources for tailnet summaries, devices, and ACL state.
- MCP prompts for connectivity diagnosis and ACL review.
- Risk-gated tools: `read`, `write`, and `admin`.
- OAuth client credentials with API key compatibility.
- Private HTTP mode with bearer auth, host validation, request limits, and health
  checks.
- Docker support for local builds and private Tailscale Serve deployments.

## Requirements

- Bun 1.3 or newer.
- Tailscale API access through one of:
  - OAuth client credentials: `TAILSCALE_OAUTH_CLIENT_ID` and
    `TAILSCALE_OAUTH_CLIENT_SECRET`.
  - Legacy API key: `TAILSCALE_API_KEY`.
- Local Tailscale CLI for CLI-backed tools such as status, ping, connect, and
  disconnect.

## MCP Client Setup

Use `stdio` for local MCP clients.

```json
{
  "mcpServers": {
    "tailscale": {
      "command": "bunx",
      "args": ["@hexsleeves/tailscale-mcp-server"],
      "env": {
        "TAILSCALE_OAUTH_CLIENT_ID": "your-client-id",
        "TAILSCALE_OAUTH_CLIENT_SECRET": "your-client-secret",
        "TAILSCALE_TAILNET": "-"
      }
    }
  }
}
```

For API key compatibility:

```json
{
  "mcpServers": {
    "tailscale": {
      "command": "bunx",
      "args": ["@hexsleeves/tailscale-mcp-server"],
      "env": {
        "TAILSCALE_API_KEY": "tskey-...",
        "TAILSCALE_TAILNET": "-"
      }
    }
  }
}
```

## HTTP Transport

HTTP mode is intended for private tailnet access. It requires
`MCP_HTTP_BEARER_TOKEN` and binds to `127.0.0.1` by default.

```bash
export MCP_TRANSPORT=http
export MCP_HTTP_BEARER_TOKEN="$(openssl rand -base64 32)"
export TAILSCALE_OAUTH_CLIENT_ID="your-client-id"
export TAILSCALE_OAUTH_CLIENT_SECRET="your-client-secret"
export TAILSCALE_TAILNET="-"

bun run src/index.ts --http --host 127.0.0.1 --port 3000
```

Expose HTTP mode privately with Tailscale Serve:

```bash
tailscale serve --bg 443 localhost:3000
```

Do not use Funnel for normal MCP operation. Funnel makes the endpoint publicly
reachable and should be reviewed separately.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio` or `http`. |
| `MCP_HTTP_BIND_HOST` | `127.0.0.1` | HTTP bind host. |
| `MCP_HTTP_PORT` | `3000` | HTTP bind port. |
| `MCP_HTTP_BEARER_TOKEN` |  | Required for HTTP mode. |
| `MCP_ALLOWED_HOSTS` |  | Comma-separated additional allowed HTTP Host values. |
| `TAILSCALE_TAILNET` | `-` | Tailnet name or `-` shorthand. |
| `TAILSCALE_API_BASE_URL` | `https://api.tailscale.com` | Tailscale API base URL. |
| `TAILSCALE_OAUTH_CLIENT_ID` |  | Preferred auth method. |
| `TAILSCALE_OAUTH_CLIENT_SECRET` |  | Preferred auth method. |
| `TAILSCALE_API_KEY` |  | API key fallback. |
| `TAILSCALE_ALLOWED_TOOL_RISK` | `read` | Maximum allowed tool risk: `read`, `write`, or `admin`. |
| `TAILSCALE_CLI_PATH` | `tailscale` | Local Tailscale CLI path. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error`. |
| `MCP_SERVER_LOG_FILE` |  | Optional file log path. |

Risk levels:

- `read`: list devices, inspect status, read resources, and run diagnostics.
- `write`: update ACLs, DNS, routes, policy files, webhooks, tags, and other
  mutating tailnet settings.
- `admin`: destructive or host-affecting operations such as delete,
  deauthorize, connect, disconnect, auth key mutation, and file sharing changes.

## Capabilities

Tools:

- Devices: `list_devices`, `device_action`, `manage_routes`.
- Network: `get_network_status`, `connect_network`, `disconnect_network`,
  `ping_peer`, `get_version`.
- Administration: `get_tailnet_info`, `manage_acl`, `manage_dns`,
  `manage_keys`, `manage_policy_file`, `manage_file_sharing`,
  `manage_exit_nodes`, `manage_webhooks`, `manage_device_tags`.

Resources:

- `tailscale://tailnet/summary`
- `tailscale://devices`
- `tailscale://devices/{deviceId}`
- `tailscale://acl/current`

Prompts:

- `diagnose_tailnet_connectivity`
- `review_acl_change`

## Docker

Build locally:

```bash
docker build -t tailscale-mcp-server .
```

Run HTTP mode on localhost:

```bash
docker run --rm \
  -e MCP_HTTP_BEARER_TOKEN="$MCP_HTTP_BEARER_TOKEN" \
  -e TAILSCALE_OAUTH_CLIENT_ID="$TAILSCALE_OAUTH_CLIENT_ID" \
  -e TAILSCALE_OAUTH_CLIENT_SECRET="$TAILSCALE_OAUTH_CLIENT_SECRET" \
  -e TAILSCALE_TAILNET="-" \
  -p 127.0.0.1:3000:3000 \
  tailscale-mcp-server
```

Or use the published image:

```bash
docker run --rm \
  -e MCP_HTTP_BEARER_TOKEN="$MCP_HTTP_BEARER_TOKEN" \
  -e TAILSCALE_OAUTH_CLIENT_ID="$TAILSCALE_OAUTH_CLIENT_ID" \
  -e TAILSCALE_OAUTH_CLIENT_SECRET="$TAILSCALE_OAUTH_CLIENT_SECRET" \
  -e TAILSCALE_TAILNET="-" \
  -p 127.0.0.1:3000:3000 \
  hexsleeves/tailscale-mcp-server:latest
```

For a sidecar deployment that exposes the server with private Tailscale Serve,
see [deploy/README.md](deploy/README.md).

## Development

```bash
bun install
bun run typecheck
bun test
bun run check
bun run build
```

Full verification:

```bash
bun run qa:full
```

Security audit:

```bash
bun audit
```
