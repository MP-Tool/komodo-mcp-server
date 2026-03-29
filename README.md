<div align="center">

# 🦎 Komodo MCP Server

**Model Context Protocol Server for [Komodo](https://github.com/moghtech/komodo)**

Manage your Docker or Podman deployments through Komodo with AI assistants and automation tools.

Komodo MCP Server enables seamless interaction between AI assistants (like Claude, GitHub Copilot) and Komodo (Container Management Platform) for efficient container management, server orchestration, and deployment operations. The MCP-Server gives you the ability to control your Komodo-managed infrastructure by using natural language or automated workflows.

[![GitHub Release](https://img.shields.io/github/v/release/MP-Tool/komodo-mcp-server?logo=github)](https://github.com/MP-Tool/komodo-mcp-server/releases) [![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE) [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://github.com/MP-Tool/komodo-mcp-server/pkgs/container/komodo-mcp-server) [![npm](https://img.shields.io/npm/v/komodo-mcp-server?logo=npm&logoColor=white)](https://www.npmjs.com/package/komodo-mcp-server) [![MCP Registry](https://img.shields.io/badge/MCP_Registry-Listed-green?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMSAxNUg5di02aDJ2NnptNC0ySDEzdi00aDJ2NHoiLz48L3N2Zz4=)](https://registry.modelcontextprotocol.io) [![MCP](https://img.shields.io/badge/MCP-Compliant-green)](https://modelcontextprotocol.io)

[![GitHub Issues](https://img.shields.io/github/issues/MP-Tool/komodo-mcp-server?logo=github)](https://github.com/MP-Tool/komodo-mcp-server/issues) [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/MP-Tool/komodo-mcp-server/badge)](https://securityscorecards.dev/viewer/?uri=github.com/MP-Tool/komodo-mcp-server) [![Build Status](https://github.com/MP-Tool/komodo-mcp-server/actions/workflows/release.yml/badge.svg)](https://github.com/MP-Tool/komodo-mcp-server/actions/workflows/release.yml) [![CodeQL](https://github.com/MP-Tool/komodo-mcp-server/actions/workflows/codeql.yml/badge.svg)](https://github.com/MP-Tool/komodo-mcp-server/actions/workflows/codeql.yml)

[Features](#features) • [Quick Start](#quick-start) • [Authentication](#authentication) • [Documentation](#documentation)

</div>

---

## Features

### 🛠️ Complete Infrastructure Control

- **52 Tools, 7 Categories** — Full lifecycle management for containers, stacks, deployments, and servers — from listing and inspecting to deploying, scaling, and destroying.
- **Remote Terminal Access** — Execute commands on servers, containers, deployments, and stack services with real-time output streaming, exit codes, and progress reporting.
- **Log Search & Analysis** — Pattern-based log search across containers with configurable tail limits and match counting.

### 🔌 Deploy Anywhere

- **Multi-Transport** — Streamable HTTP (stateful), HTTPS with TLS, legacy SSE, and stdio. Same server, any client.
- **Multi-Platform Docker** — Production-ready images for `amd64`, `arm64`, `arm/v7`, and `arm/v6` (Raspberry Pi). Non-root, multi-stage builds with tini init.
- **Works with Any MCP Client** — Claude Desktop, VS Code / GitHub Copilot, or any MCP-compatible tool. Runs via Docker, npx, or native Node.js.

### 🔐 Security & Authentication

- **Three Auth Methods** — API Key/Secret (recommended), username/password, or JWT token. All support Docker secrets via `*_FILE` variants.
- **Runtime Configuration** — Set or change credentials dynamically via `komodo_configure` without restarting the server.
- **Hardened by Default** — Input validation (Zod), secret scrubbing in logs, rate limiting, DNS rebinding protection, and security headers via Helmet.

### ⚡ Reliability & Operations

- **Live Progress & Cancellation** — Long-running operations (deploy, start, stop) report real-time progress. Cancel any operation mid-flight via AbortSignal.
- **Auto-Reconnection** — Connection monitoring with automatic recovery and exponential backoff. Auth failures stop retries immediately.
- **Health & Readiness** — Kubernetes-ready `/health` and `/ready` endpoints. `komodo_health_check` reports server version, connectivity, and auth status.

*Built on [mcp-server-framework](https://github.com/MP-Tool/mcp-server-framework) — a production-ready TypeScript MCP server framework with structured logging, OpenTelemetry, and session management.*


## Available Tools (52)

| Category | Tools |
|----------|-------|
| **Configuration** | `komodo_configure`, `komodo_health_check` |
| **Containers** | `komodo_list_containers`, `komodo_inspect_container`, `komodo_get_container_logs`, `komodo_search_logs`, `komodo_prune`, `komodo_start_container`, `komodo_stop_container`, `komodo_restart_container`, `komodo_pause_container`, `komodo_unpause_container` |
| **Servers** | `komodo_list_servers`, `komodo_get_server_info`, `komodo_get_server_stats`, `komodo_create_server`, `komodo_update_server`, `komodo_delete_server` |
| **Stacks** | `komodo_list_stacks`, `komodo_get_stack_info`, `komodo_create_stack`, `komodo_update_stack`, `komodo_delete_stack`, `komodo_deploy_stack`, `komodo_pull_stack`, `komodo_start_stack`, `komodo_restart_stack`, `komodo_pause_stack`, `komodo_unpause_stack`, `komodo_stop_stack`, `komodo_destroy_stack` |
| **Deployments** | `komodo_list_deployments`, `komodo_get_deployment_info`, `komodo_create_deployment`, `komodo_update_deployment`, `komodo_delete_deployment`, `komodo_deploy_container`, `komodo_pull_deployment_image`, `komodo_start_deployment`, `komodo_restart_deployment`, `komodo_pause_deployment`, `komodo_unpause_deployment`, `komodo_stop_deployment`, `komodo_destroy_deployment` |
| **Terminal** | `komodo_server_exec`, `komodo_container_exec`, `komodo_deployment_exec`, `komodo_stack_service_exec` |
| **API Keys** | `komodo_list_api_keys`, `komodo_create_api_key`, `komodo_delete_api_key` |

> **Tip:** Use `komodo_configure` to set credentials at runtime, and `komodo_health_check` to verify connectivity before running other tools.


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

→ **[Full Docker Guide](docker/README.md)**

### Claude Desktop

Add to your `claude_desktop_config.json` (Settings → Developer → Edit Config):

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

→ **[Full Claude Guide](examples/claude/README.md)**

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

→ **[Full VS Code Guide](examples/vscode/README.md)** · **[Node.js / npx (no Docker)](examples/node/README.md)** · **[All Integrations](examples/README.md)**

## Use

Once connected, ask Claude, Copilot, or any MCP-compatible assistant:

```
"List all my Komodo servers"
"Show containers on production-server"  
"Start the nginx container"
"Deploy my-app to staging"
"Get stats for dev-server"
```

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector --url http://localhost:8000/mcp
```

Use `/mcp` for Streamable HTTP or `/sse` for legacy SSE transport (if enabled). Adjust host and port to match your setup.

## Authentication

Three methods are supported — use whichever fits your setup:

| Method | Environment Variables | Best For |
|--------|----------------------|----------|
| **API Key** (recommended) | `KOMODO_API_KEY` + `KOMODO_API_SECRET` | Service accounts, automation |
| **Username / Password** | `KOMODO_USERNAME` + `KOMODO_PASSWORD` | Interactive users |
| **JWT Token** | `KOMODO_JWT_TOKEN` | Browser-based SSO (OIDC, GitHub, Google OAuth) |

`KOMODO_URL` is always required. All credentials also support Docker secrets via `*_FILE` variants (e.g. `KOMODO_API_KEY_FILE`).

For the full configuration reference (env vars, config files, Docker secrets), see the **[Configuration Guide](config/README.md)**.

## Disclaimer

AI tools (GitHub Copilot, Claude) are used as part of the development workflow — for code generation, architecture exploration, and documentation drafting. Every line of code and documentation is manually reviewed to ensure quality, correctness, and compliance with established engineering standards.

This software is provided under the [GPL-3.0 License](LICENSE). If you find bugs or have ideas, [issues](https://github.com/MP-Tool/komodo-mcp-server/issues) and [contributions](CONTRIBUTING.md) are always welcome.

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
GPL-3.0 License - see [LICENSE](LICENSE) for details.

### Requirements

- **Komodo** v2.0.0 or later
- **Docker** (for containerized deployment) or **Node.js 22+** (for native installation)
- **Valid Komodo credentials** (API Key/Secret, Username/Password, or JWT Token)

## Security
Report security vulnerabilities via GitHub's Private Vulnerability Reporting (see [SECURITY.md](SECURITY.md)).

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
