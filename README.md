<div align="center">

# 🦎 Komodo MCP Server

**Model Context Protocol Server for [Komodo](https://github.com/moghtech/komodo)**

Manage your Docker or Podman deployments through Komodo with AI assistants and automation tools.

Komodo MCP Server enables seamless interaction between AI assistants (like Claude, GitHub Copilot) and Komodo (Container Management Platform) for efficient container management, server orchestration, and deployment operations. The MCP-Server gives you the ability to control your Komodo-managed infrastructure by using natural language or automated workflows.

[![GitHub Release](https://img.shields.io/github/v/release/MP-Tool/komodo-mcp-server?logo=github)](https://github.com/MP-Tool/komodo-mcp-server/releases) [![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE.txt) [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://github.com/MP-Tool/komodo-mcp-server/pkgs/container/komodo-mcp-server) [![npm](https://img.shields.io/npm/v/komodo-mcp-server?logo=npm&logoColor=white)](https://www.npmjs.com/package/komodo-mcp-server) [![MCP Registry](https://img.shields.io/badge/MCP_Registry-Listed-green?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMSAxNUg5di02aDJ2NnptNC0ySDEzdi00aDJ2NHoiLz48L3N2Zz4=)](https://registry.modelcontextprotocol.io) [![MCP](https://img.shields.io/badge/MCP-Compliant-green)](https://modelcontextprotocol.io)

[![GitHub Issues](https://img.shields.io/github/issues/MP-Tool/komodo-mcp-server?logo=github)](https://github.com/MP-Tool/komodo-mcp-server/issues) [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/MP-Tool/komodo-mcp-server/badge)](https://securityscorecards.dev/viewer/?uri=github.com/MP-Tool/komodo-mcp-server) [![Build Status](https://github.com/MP-Tool/komodo-mcp-server/actions/workflows/release.yml/badge.svg)](https://github.com/MP-Tool/komodo-mcp-server/actions/workflows/release.yml) [![CodeQL](https://github.com/MP-Tool/komodo-mcp-server/actions/workflows/codeql.yml/badge.svg)](https://github.com/MP-Tool/komodo-mcp-server/actions/workflows/codeql.yml)

[Features](#features) • [Quick Start](#quick-start) • [Authentication](#authentication) • [Documentation](#documentation)

</div>

---

## Features

### 🛠️ Complete Infrastructure Control

- **88 Tools, 20 Categories** — Full lifecycle management for containers, stacks, deployments, servers, builds, repos, procedures, actions, alerters, Docker Swarms (Komodo v2), variables, resource syncs, update history, Docker image/network/volume introspection, builders, tags and TOML export — from listing and inspecting to deploying, building, scaling and destroying.
- **Remote Terminal Access** — Execute commands on servers, containers, deployments, and stack services with real-time output streaming, exit codes, and progress reporting.
- **Log Search & Analysis** — Pattern-based log search across containers with configurable tail limits and match counting.

### 🔌 Deploy Anywhere

- **Multi-Transport** — Streamable HTTP (stateful), HTTPS with TLS, legacy SSE, and stdio. Same server, any client.
- **Multi-Platform Docker** — Production-ready images for `amd64`, `arm64`, `arm/v7`, and `arm/v6` (Raspberry Pi). Non-root, multi-stage builds with tini init.
- **Works with Any MCP Client** — Claude Desktop, VS Code / GitHub Copilot, or any MCP-compatible tool. Runs via Docker, npx, or native Node.js.

### 🔐 Security & Authentication

- **Three Auth Methods** — API Key/Secret (recommended), username/password, or JWT token. All support Docker secrets via `*_FILE` variants.
- **Auth Enabled by Default** — Over HTTP every caller authenticates as a Komodo user and acts with that user's permissions: interactively (username/password or API key) or without a browser (OAuth `client_credentials`). The global `[komodo]` connection is used only for stdio, auth-disabled deployments, and clients you register explicitly.
- **Confirmation for Destructive Actions** — Deletes, destroys, prunes, and shell execution ask the human operator for explicit approval first (MCP elicitation with a confirm checkbox). Fail-closed on clients that can't prompt; tunable via `MCP_CONFIRM_DESTRUCTIVE` / `MCP_CONFIRM_FALLBACK`.
- **Hardened by Default** — Input validation (Zod), rate limiting, DNS rebinding protection, security headers via Helmet, and central fail-closed secret redaction: every tool result (including exec output and retrieved logs) passes the framework's scrub boundary before it reaches the client transcript — see [Secret Redaction](config/README.md#secret-redaction).

### ⚡ Reliability & Operations

- **Live Progress & Cancellation** — Long-running operations (deploy, start, stop) report real-time progress. Cancel any operation mid-flight via AbortSignal.
- **Auto-Reconnection** — Connection monitoring with automatic recovery and exponential backoff. Auth failures stop retries immediately.
- **Health & Readiness** — Kubernetes-ready `/health` and `/ready` endpoints. `komodo_health_check` reports server version, connectivity, and auth status.

*Built on [mcp-server-framework](https://github.com/MP-Tool/mcp-server-framework) — a production-ready TypeScript MCP server framework with structured logging, OpenTelemetry, and session management.*


## Available Tools (69)

| Category | Tools |
|----------|-------|
| **Configuration** | `komodo_health_check` |
| **Containers** | `komodo_container_list`, `komodo_container_inspect`, `komodo_container_logs`, `komodo_container_search_logs`, `komodo_container_action` *(start/stop/restart/pause/unpause)* |
| **Servers** | `komodo_server_list`, `komodo_server_info`, `komodo_server_stats`, `komodo_server_apply` *(create/update)*, `komodo_server_delete`, `komodo_server_action` *(start_all/restart_all/pause_all/unpause_all/stop_all\_containers, prune\_\*, delete\_network/image/volume)* |
| **Stacks** | `komodo_stack_list`, `komodo_stack_info`, `komodo_stack_apply` *(create/update)*, `komodo_stack_delete`, `komodo_stack_action` *(deploy/pull/start/restart/pause/unpause/stop/destroy)* |
| **Deployments** | `komodo_deployment_list`, `komodo_deployment_info`, `komodo_deployment_apply` *(create/update)*, `komodo_deployment_delete`, `komodo_deployment_action` *(deploy/pull/start/restart/pause/unpause/stop/destroy)* |
| **Builds** | `komodo_build_list`, `komodo_build_info`, `komodo_build_action` *(run/cancel)*, `komodo_build_logs`, `komodo_build_apply` *(create/update)*, `komodo_build_delete` |
| **Repos** | `komodo_repo_list`, `komodo_repo_info`, `komodo_repo_action` *(clone/pull/build/cancel_build)*, `komodo_repo_apply` *(create/update)*, `komodo_repo_delete` |
| **Procedures** | `komodo_procedure_list`, `komodo_procedure_info`, `komodo_procedure_action` *(run)*, `komodo_procedure_apply` *(create/update)*, `komodo_procedure_delete` |
| **Actions** | `komodo_action_list`, `komodo_action_info`, `komodo_action_action` *(run/cancel)*, `komodo_action_apply` *(create/update)*, `komodo_action_delete` |
| **Alerters** | `komodo_alerter_list`, `komodo_alerter_info`, `komodo_alerter_apply` *(create/update)*, `komodo_alerter_delete` |
| **Swarms** | `komodo_swarm_list`, `komodo_swarm_info`, `komodo_swarm_apply` *(create/update)*, `komodo_swarm_delete`, `komodo_swarm_nodes_list`, `komodo_swarm_services_list`, `komodo_swarm_action` *(update_node/remove_nodes/remove_services/remove_stacks)* |
| **Resource Syncs** | `komodo_resource_sync_list`, `komodo_resource_sync_info`, `komodo_resource_sync_action` *(run/refresh)*, `komodo_resource_sync_apply` *(create/update)*, `komodo_resource_sync_delete` |
| **Variables** | `komodo_variable_list`, `komodo_variable_info`, `komodo_variable_apply` *(create/update — value/description/is_secret)*, `komodo_variable_delete` |
| **Updates** | `komodo_update_list` *(filterable, paginated)*, `komodo_update_info` |
| **Terminal** | `komodo_exec` *(target: server / container / deployment / stack_service)* |
| **API Keys** | `komodo_user_list_api_keys`, `komodo_user_create_api_key`, `komodo_user_delete_api_key` |
| **Docker** | `komodo_docker_image_list`, `komodo_docker_image_inspect`, `komodo_docker_image_history`, `komodo_docker_network_list`, `komodo_docker_network_inspect`, `komodo_docker_volume_list`, `komodo_docker_volume_inspect` |
| **Builders** | `komodo_builder_list`, `komodo_builder_info`, `komodo_builder_apply` *(create/update)*, `komodo_builder_copy`, `komodo_builder_rename`, `komodo_builder_delete` |
| **Tags** | `komodo_tag_list`, `komodo_tag_info`, `komodo_tag_apply` *(create/update)*, `komodo_tag_delete` |
| **TOML Export** | `komodo_toml_export_all`, `komodo_toml_export_resources` |

> **Tip:** Every tool carries `_meta.category` (one of `config`, `container`, `server`, `stack`, `deployment`, `build`, `repo`, `procedure`, `action`, `alerter`, `swarm`, `resource_sync`, `variable`, `update`, `terminal`, `user`, `docker`, `builder`, `tag`, `toml`) and a `requiredScopes` array (`komodo:read` / `komodo:operate` / `komodo:admin`), so MCP clients and gateways can filter or gate tools by category and three-tier RBAC.
>
> **Limit the tool surface (server-side).** To keep a client's tool list - and its token cost - small, prune what the server registers with three optional env vars: `MCP_TOOLS_ALLOWED_CATEGORIES` (category allowlist; unset -> all), `MCP_TOOLS_EXCLUDED_CATEGORIES` (drop whole categories), and `MCP_TOOLS_EXCLUDED_TOOLS` (drop tools by name, e.g. `komodo_exec`). Use the exact category strings above. Pruned tools are absent from `tools/list` and not callable. This is purely subtractive - it never exposes more and never bypasses authentication or the read-only-when-open behavior.
>
> List/info/logs tools support **cursor pagination** via `{ cursor, page_size }` (1–100, default 25) and emit `_meta.page.next_cursor` when more items are available. `inspect`, `info`, `logs`, and `search_logs` responses also include a session-scoped `ephemeral://...` resource link so large payloads can be fetched out-of-band via `resources/read`; pass `inline_full: true` to force inlining.


## Quick Start

### Docker Compose (Recommended for HTTP)

Deploy as a persistent HTTP server — connect from any MCP client.

```bash
mkdir komodo-mcp && cd komodo-mcp
curl -O https://raw.githubusercontent.com/MP-Tool/komodo-mcp-server/main/docker/compose.yaml
curl -O https://raw.githubusercontent.com/MP-Tool/komodo-mcp-server/main/docker/docker.env
cp docker.env .env  # Edit with your credentials
docker compose up -d
```

-> **[Full Docker Guide](docker/README.md)**

### Claude Desktop

Add to your `claude_desktop_config.json` (Settings -> Developer -> Edit Config):

```json
"komodo-mcp-server": {
  "command": "docker",
  "args": [
    "run", "-i", "--rm",
    "-e", "KOMODO_URL=https://komodo.example.com:9120",
    "-e", "KOMODO_API_KEY=api-key",
    "-e", "KOMODO_API_SECRET=api-secret",
    "ghcr.io/mp-tool/komodo-mcp-server:latest"
  ]
}
```

-> **[Full Claude Guide](examples/claude/README.md)**

### VS Code / GitHub Copilot

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "Komodo MCP Server": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "KOMODO_URL=https://komodo.example.com:9120",
        "-e", "KOMODO_API_KEY=api-key",
        "-e", "KOMODO_API_SECRET=api-secret",
        "ghcr.io/mp-tool/komodo-mcp-server:latest"
      ]
    }
  }
}
```

-> **[Full VS Code Guide](examples/vscode/README.md)** · **[Node.js / npx (no Docker)](examples/node/README.md)** · **[All Integrations](examples/README.md)**

## Use

Once connected, ask Claude, Copilot, or any MCP-compatible assistant in plain language — it picks the tools. The tool each prompt drives is shown on the right:

| Prompt | Tool(s) called |
|--------|----------------|
| "List all my Komodo servers" | `komodo_server_list` |
| "Show containers on production-server" | `komodo_container_list` |
| "Start the nginx container" | `komodo_container_action` *(start)* |
| "Deploy my-app to staging" | `komodo_deployment_action` *(deploy)* |
| "Get stats for dev-server" | `komodo_server_stats` |
| "Why did the last deploy fail?" | `komodo_update_list` -> `komodo_update_info` |
| "Tail the logs for the api container" | `komodo_container_logs` |

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector --url http://localhost:8000/mcp
```

Use `/mcp` for Streamable HTTP or `/sse` for legacy SSE transport (if enabled). Adjust host and port to match your setup.

## Authentication

There are two distinct layers - don't confuse them:

**1. Connecting to Komodo** - how the server itself talks to Komodo Core. Choose one method:

| Method | Environment Variables | Best For |
|--------|----------------------|----------|
| **API Key** (recommended) | `KOMODO_API_KEY` + `KOMODO_API_SECRET` | Service accounts, automation |
| **Username / Password** | `KOMODO_USERNAME` + `KOMODO_PASSWORD` | Interactive users |
| **JWT Token** | `KOMODO_JWT_TOKEN` | Browser-based SSO (OIDC, GitHub, Google OAuth) |

`KOMODO_URL` is always required. All credentials also support Docker secrets via `*_FILE` variants
(e.g. `KOMODO_API_KEY_FILE`). This shared connection is used for stdio and for open (auth-disabled)
HTTP mode.

**2. Clients authenticating to the MCP server** (HTTP/HTTPS) - **on by default** since 1.5.0.
Every caller proves who they are with a Komodo credential and then acts as exactly that Komodo
user, with that user's permissions - never more:

| How the client authenticates | Needs a browser | Acts as |
|------------------------------|-----------------|---------|
| **Login page** - Komodo username + password | once | that user |
| **Login page** - Komodo API key + secret (works for SSO-only and 2FA accounts) | once | the key's user |
| **Login page** - your identity provider (OpenID Connect; needs a Komodo Core with token exchange) | once | the Komodo user linked to it |
| **OAuth `client_credentials`** - `client_id` = API key, `client_secret` = API secret | no | the key's user |
| **OAuth `client_credentials`** - a client registered in `[auth.clients]`, with a secret or a key | no | the `[komodo]` service account |
| **`X-Api-Key` / `X-Api-Secret` headers** - opt-in with `MCP_AUTH_API_KEY_HEADER=true` | no | the key's user |

For automation and gateways, create a Komodo **service user** with just the permissions it needs,
give it an API key, and let the client present that key. See
[MCP-Server Authentication](config/README.md#mcp-server-authentication) for each option and
[examples/machine-clients](examples/machine-clients/) for ready-to-use snippets.

Turn authentication off with `MCP_AUTH_ENABLED=false` and the network server is **read-only** for
everyone; there is no setting that lets a caller without a credential write. `stdio` is local and
never authenticated.

For the full configuration reference (env vars, config files, Docker secrets), see the **[Configuration Guide](config/README.md)**.

## Troubleshooting

**Connection refused / the server can't reach Komodo.** Check `KOMODO_URL` — it needs the scheme, host, and Komodo Core port (e.g. `https://komodo.example.com:9120`). From inside Docker, `localhost` points at the container, not the host — use the host's IP or a Docker network alias. Confirm nothing (firewall, reverse proxy) blocks the port.

**401 Unauthorized when a client connects (HTTP).** Since 1.5.0, authentication defaults **on** for HTTP/HTTPS, so the client has to authenticate: complete the browser login (Komodo username/password, or an API key if your account uses SSO or 2FA), or configure the client with OAuth client credentials / API-key headers - see [Authentication](#authentication). A 401 *after* that usually means the Komodo credentials are wrong, the API key expired, or the account is disabled. To run without authentication set `MCP_AUTH_ENABLED=false` (read-only). (stdio is local and never requires this.)

**The server stops with "…public URL … is not HTTPS".** OAuth needs TLS. Set `MCP_BASE_URL` to the `https://` address clients use (reverse proxy, or `MCP_TRANSPORT=https` with a certificate). On a network that already encrypts traffic (Tailscale, WireGuard) you can accept plain HTTP explicitly - see [Plain HTTP on private networks](config/README.md#plain-http-on-private-networks).

**Tools are missing from the list.** Two causes, both by design:
- **Read-only mode.** If you disabled auth (`MCP_AUTH_ENABLED=false`) on an HTTP/HTTPS transport, the server is read-only for anonymous callers — every write/exec/delete tool (incl. `komodo_exec`) is hidden and rejected. Enable `[auth]` to get them back. Startup logs a `READ-ONLY` notice when this is active.
- **Your Komodo permissions.** With authentication on, you only see the tools your Komodo user (or the user your API key belongs to) may use. A read-only service user sees read tools only.
- **Tool-surface filter.** `MCP_TOOLS_ALLOWED_CATEGORIES`, `MCP_TOOLS_EXCLUDED_CATEGORIES`, or `MCP_TOOLS_EXCLUDED_TOOLS` prune the registered set. Unset all three to expose everything. A bad category name is ignored with a startup warning listing the valid categories.

## Disclaimer

AI tools (GitHub Copilot, Claude) are used as part of the development workflow — for code generation, architecture exploration, and documentation drafting. Every line of code and documentation is manually reviewed to ensure quality, correctness, and compliance with established engineering standards.

This software is provided under the [GPL-3.0 License](LICENSE.txt). If you find bugs or have ideas, [issues](https://github.com/MP-Tool/komodo-mcp-server/issues) and [contributions](CONTRIBUTING.md) are always welcome.

## Contributing
Contributions are welcome! See our [Contributing Guide](CONTRIBUTING.md) for details.

- 🐛 [Report bugs](https://github.com/MP-Tool/komodo-mcp-server/issues)
- 💡 [Request features](https://github.com/MP-Tool/komodo-mcp-server/issues)
- 🔧 [Submit PRs](https://github.com/MP-Tool/komodo-mcp-server/pulls)

### Development

```bash
# Clone and install
git clone https://github.com/MP-Tool/komodo-mcp-server.git
cd komodo-mcp-server
npm install

# Build and run
npm run build
npm start
```

## Documentation

| Guide | Description |
|-------|-------------|
| **[Configuration](config/README.md)** | All environment variables, config file formats, priority chain, Docker secrets |
| **[Docker Deployment](docker/README.md)** | Docker Compose setup, health checks, production deployment |
| **[Client Integrations](examples/README.md)** | Claude Desktop, VS Code, Node.js/npx setup guides |
| **[Contributing](CONTRIBUTING.md)** | Development setup, coding standards, PR guidelines |
| **[Security](SECURITY.md)** | Vulnerability reporting, security best practices |
| **[Changelog](CHANGELOG.md)** | Version history and release notes |

### License
GPL-3.0 License - see [LICENSE](LICENSE.txt) for details.

### Requirements

- **Komodo** v2 (Komodo Core 2.x; the server refuses version-sensitive tools like `komodo_exec` on older cores)
- **Docker** (for containerized deployment) or **Node.js 22.23.4+, 24.22.1+ or 26.12.1+** (for native installation)
- **Valid Komodo credentials** (API Key/Secret, Username/Password, or JWT Token)

## Security
Report security vulnerabilities via GitHub's Private Vulnerability Reporting (see [SECURITY.md](SECURITY.md)).

**Destructive-action confirmation:** By default, destructive tools (all `*_delete` tools, `komodo_exec`, stack/deployment `destroy`, server `stop_all`/`prune_*`/`delete_*`, swarm `remove_*`, and procedure/action/resource-sync `run`) require the human operator to approve an MCP elicitation prompt — "accept" plus a ticked confirm checkbox — before anything executes. Clients that cannot prompt (no elicitation support, or stateless HTTP mode) are refused by default. Tune with `MCP_CONFIRM_FALLBACK=allow` (execute with a warning on such clients) or `MCP_CONFIRM_DESTRUCTIVE=false` (disable the feature) — relevant for stdio setups whose client lacks elicitation support.

**Secret redaction:** Tool results are persisted to the MCP client transcript and forwarded to the model provider, so every tool result passes the framework's central, fail-closed scrub boundary before it leaves the process — structured resource config (env blocks, `webhook_secret`, `passkey`), alerter webhook URLs, exec output, and container/build/update logs, for inline payloads and offloaded resource links alike. On top, `is_secret` variable values are always masked and stacks drop the post-interpolation `deployed_config`/`deployed_contents`. Best-effort defence-in-depth: heuristics catch deterministic secret shapes, not arbitrary material. Intended exception: `komodo_user_create_api_key` returns its one-time secret unredacted. See [Secret Redaction](config/README.md#secret-redaction).

**Best practices:**
- Never commit credentials
- Use environment variables
- Keep dependencies updated
- Run as non-root user (default in Docker)

## Links

- **[Komodo](https://github.com/moghtech/komodo)** — Container management platform
- **[Komodo Docs](https://komo.do/docs)** — Official documentation
- **[MCP Specification](https://modelcontextprotocol.io)** — Model Context Protocol
- **[MCP Registry](https://registry.modelcontextprotocol.io)** — MCP server registry

---

<div align="center">

**Built with ❤️ for the Komodo community 🦎**

[Report Bug](https://github.com/MP-Tool/komodo-mcp-server/issues) · [Request Feature](https://github.com/MP-Tool/komodo-mcp-server/issues) · [Discussions](https://github.com/MP-Tool/komodo-mcp-server/discussions)

</div>
