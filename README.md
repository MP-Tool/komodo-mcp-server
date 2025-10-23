<div align="center">

# 🦎 Komodo MCP Server

**Model Context Protocol server for [Komodo Container Manager](https://github.com/moghtech/komodo)**

Manage Docker containers, deployments, and stacks through AI assistants and automation tools.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE) [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://github.com/MP-Tool/komodo-mcp-server/pkgs/container/komodo-mcp-server) [![MCP](https://img.shields.io/badge/MCP-Compatible-green)](https://modelcontextprotocol.io)

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

## Available Tools

| Tool | Description |
|------|-------------|
| `komodo_configure` | Configure Komodo server connection |
| `komodo_list_servers` | List all available servers |
| `komodo_get_server_stats` | Get server statistics and status |
| `komodo_list_containers` | List Docker containers on a server |
| `komodo_start_container` | Start a Docker container |
| `komodo_stop_container` | Stop a Docker container |
| `komodo_restart_container` | Restart a Docker container |
| `komodo_pause_container` | Pause a Docker container |
| `komodo_unpause_container` | Unpause a Docker container |
| `komodo_list_deployments` | List all deployments |
| `komodo_deploy_container` | Deploy a container |
| `komodo_list_stacks` | List Docker Compose stacks |
| `komodo_deploy_stack` | Deploy a Docker Compose stack |
| `komodo_stop_stack` | Stop a Docker Compose stack |

## Documentation

### Integration Guides

- **[Claude Desktop](examples/claude/)** - Direct MCP integration
- **[VS Code](examples/vscode/)** - GitHub Copilot Chat support  
- **[Docker Compose](examples/compose/)** - Standalone deployment
- **[Docker Desktop](examples/docker-desktop/)** - Native MCP beta feature

### Requirements

- **Komodo** v1.19.5 or later
- **Docker** (for containerized deployment)
- **Node.js 20+** (for local development)
- Valid Komodo credentials (username/password)

## Development

```bash
# Clone and install
git clone https://github.com/MP-Tool/komodo-mcp-server.git
cd komodo-mcp-server
npm install

# Build and run
npm run build
npm start
```

### Project Structure

```
komodo-mcp-server/
├── src/
│   ├── index.ts              # MCP server implementation
│   └── komodo-client.ts      # Komodo API client
├── examples/
│   ├── claude/               # Claude Desktop integration
│   ├── docker-desktop/       # Docker Desktop integration
│   ├── vscode/               # VS Code integration
│   └── compose/              # Docker Compose setup
├── Dockerfile                # Multi-stage production build
└── package.json              # Dependencies and scripts
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Security

Report security vulnerabilities via email (see [SECURITY.md](SECURITY.md)).

**Best practices:**
- Never commit credentials
- Use environment variables
- Keep dependencies updated
- Run as non-root user (default in Docker)

## Contributing

Contributions are welcome! See our [Contributing Guide](CONTRIBUTING.md) for details.

**Quick Start:**
- 🐛 [Report bugs](https://github.com/MP-Tool/komodo-mcp-server/issues)
- 💡 [Request features](https://github.com/MP-Tool/komodo-mcp-server/issues)
- 🔧 [Submit PRs](https://github.com/MP-Tool/komodo-mcp-server/pulls)
- 📦 [Release Process](RELEASE.md) - Automated releases on version bump

## Security

Report security vulnerabilities via [GitHub Security Advisories](https://github.com/MP-Tool/komodo-mcp-server/security/advisories). See [SECURITY.md](SECURITY.md) for details.

## License

GPL-3.0 License - see [LICENSE](LICENSE) for details.

## Links

- **[Komodo GitHub](https://github.com/moghtech/komodo)** - Container orchestration platform
- **[Komodo Docs](https://komo.do/docs)** - Komodo documentation
- **[Model Context Protocol](https://modelcontextprotocol.io)** - MCP specification
- **[Examples & Integrations](examples/)** - Ready-to-use configurations

---

<div align="center">

**Built with ❤️ for the Komodo community**

[Report Bug](https://github.com/MP-Tool/komodo-mcp-server/issues) • [Request Feature](https://github.com/MP-Tool/komodo-mcp-server/issues) • [Discussions](https://github.com/MP-Tool/komodo-mcp-server/discussions)

</div>
