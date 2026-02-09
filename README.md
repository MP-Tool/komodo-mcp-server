<div align="center">

# 🦎 Komodo MCP Server

**Model Context Protocol Server for [Komodo](https://github.com/moghtech/komodo)**

Manage your Docker or Podman deployments through Komodo with AI assistants and automation tools.

Komodo MCP Server enables seamless interaction between AI assistants (like Claude, GitHub Copilot) and Komodo (Container Management Platform) for efficient container management, server orchestration, and deployment operations. The MCP-Server gives you the ability to control your Komodo-managed infrastructure by using natural language or automated workflows.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE) [![GitHub Release](https://img.shields.io/github/v/release/MP-Tool/komodo-mcp-server?logo=github)](https://github.com/MP-Tool/komodo-mcp-server/releases) [![MCP Registry](https://img.shields.io/badge/MCP_Registry-Listed-8A2BE2?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMSAxNUg5di02aDJ2NnptNC0ySDEzdi00aDJ2NHoiLz48L3N2Zz4=)](https://registry.modelcontextprotocol.io)  [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://github.com/MP-Tool/komodo-mcp-server/pkgs/container/komodo-mcp-server) [![MCP](https://img.shields.io/badge/MCP-Compatible-green)](https://modelcontextprotocol.io)

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/MP-Tool/komodo-mcp-server/badge)](https://securityscorecards.dev/viewer/?uri=github.com/MP-Tool/komodo-mcp-server) [![GitHub Issues](https://img.shields.io/github/issues/MP-Tool/komodo-mcp-server?logo=github)](https://github.com/MP-Tool/komodo-mcp-server/issues) [![Build Status](https://github.com/MP-Tool/komodo-mcp-server/actions/workflows/release.yml/badge.svg)](https://github.com/MP-Tool/komodo-mcp-server/actions/workflows/release.yml) [![CodeQL](https://github.com/MP-Tool/komodo-mcp-server/actions/workflows/codeql.yml/badge.svg)](https://github.com/MP-Tool/komodo-mcp-server/actions/workflows/codeql.yml)

[Features](#features) • [Quick Start](#quick-start) • [Examples](#examples) • [Documentation](#documentation)

</div>

---

## Features

<table>
<tr>
<td width="50%">

### 🐳 Container Management
- Start, stop, restart containers
- Pause and unpause operations  
- List and monitor containers
- Cross-server management

</td>
<td width="50%">

### 📦 Deployment & Stacks
- Deploy containers and updates
- Manage Docker Compose stacks
- Multi-environment deployments
- Stack lifecycle control

</td>
</tr>
<tr>
<td width="50%">

### 🖥️ Server Operations
- List all managed servers
- Get server statistics
- Health monitoring
- Resource tracking

</td>
<td width="50%">

### 🤖 MCP Integration
- Works with any MCP client
- Claude Desktop ready
- VS Code Copilot support
- n8n automation compatible
- Dual Transport (Stdio + HTTP/SSE)

</td>
</tr>
<tr>
<td width="50%">

### ⚡ Performance
- Pre-compiled regex for logging
- Tool registry caching
- O(1) circular buffer history
- Request cancellation support

</td>
<td width="50%">

### 🔒 Security & Reliability
- DNS rebinding protection
- Rate limiting (configurable)
- CORS origin validation
- Graceful shutdown handling

</td>
</tr>
</table>

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Pull the image
docker pull ghcr.io/mp-tool/komodo-mcp-server:latest

# Run with Docker Compose
cd examples/compose
cp .env.example .env
# Edit .env with your Komodo credentials
docker compose up -d
```

### Option 2: Claude Desktop

```bash
# Copy config
cp examples/claude/claude_desktop_config.json \
   ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Edit credentials and restart Claude
```

### Option 3: VS Code

```bash
# Global integration
mkdir -p ~/.vscode/mcp
cp examples/vscode/mcp.json ~/.vscode/mcp/

# Edit credentials and reload VS Code
```

> **📚 Full setup guides:** See [`examples/`](examples/) for detailed instructions

## Examples

### 💬 With AI Assistants

Ask Claude, Copilot, or any MCP-compatible assistant:

```
"List all my Komodo servers"
"Show containers on production-server"  
"Start the nginx container"
"Deploy my-app to staging"
"Get stats for dev-server"
```

### 🔄 With n8n Automation

Comming soon: Pre-built n8n workflows for automated container health checks and deployment pipelines.

## Documentation

### Requirements
- **Komodo** v1.19.5 or later
- **Docker** (for containerized deployment)
- **Node.js 20+** (for local development)
- **Valid Komodo credentials** (API Key/Secret or username/password)

### Integration Guides
- **[Claude Desktop](examples/claude/)** - Direct MCP integration
- **[VS Code](examples/vscode/)** - GitHub Copilot Chat support  
- **[Docker Compose](examples/compose/)** - Standalone deployment
- **[Docker Desktop](examples/docker-desktop/)** - Native MCP beta feature

### Observability (OpenTelemetry)

Enable distributed tracing and metrics with OpenTelemetry:

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_ENABLED` | `false` | Enable OpenTelemetry |
| `OTEL_SERVICE_NAME` | `mcp-server` | Service name for traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | - | OTLP endpoint (e.g., Jaeger, Grafana) |
| `OTEL_DEBUG` | `false` | Enable debug logging |


## License
GPL-3.0 License - see [LICENSE](LICENSE) for details.

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

## Security
Report security vulnerabilities via GitHub's Private Vulnerability Reporting (see [SECURITY.md](SECURITY.md)).

**Best practices:**
- Never commit credentials
- Use environment variables
- Keep dependencies updated
- Run as non-root user (default in Docker)

## Links

- **[Komodo GitHub](https://github.com/moghtech/komodo)** - Container orchestration platform
- **[Komodo Docs](https://komo.do/docs)** - Komodo documentation
- **[Model Context Protocol](https://modelcontextprotocol.io)** - MCP specification
- **[Examples & Integrations](examples/)** - Ready-to-use configurations

---

<div align="center">

**Built with ❤️ for the Komodo  community 🦎**
[Report Bug](https://github.com/MP-Tool/komodo-mcp-server/issues) • [Request Feature](https://github.com/MP-Tool/komodo-mcp-server/issues) • [Discussions](https://github.com/MP-Tool/komodo-mcp-server/discussions)

</div>
