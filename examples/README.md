# Client Integrations

Ready-to-use configurations for connecting the Komodo MCP Server to AI assistants and development tools.

> **Looking for server deployment?** See the [Docker Compose Guide](../docker/README.md) for running the MCP server as a standalone service.

## Available Integrations

### [Claude Desktop](./claude/)

Direct MCP integration with Claude Desktop. Manage your Komodo infrastructure through natural language conversations.

- Runs the server as a Docker container via stdio transport
- Zero network configuration needed
- **Best for:** AI-assisted container management

### [VS Code / GitHub Copilot](./vscode/)

GitHub Copilot Chat integration for VS Code. Access Komodo tools directly from your development environment.

- Supports both stdio (Docker) and HTTP transport
- Works with workspace or global MCP settings
- **Best for:** Developer workflows and IDE integration

### [Node.js / npx](./node/)

Run directly with Node.js — no Docker required. Works on Windows, macOS, and Linux.

- Instant setup via `npx komodo-mcp-server`
- Also works as a globally installed package
- **Best for:** Quick testing, native installation, CI/CD pipelines

## Comparison

| Feature | Claude Desktop | VS Code | Node.js / npx |
|---------|---------------|---------|----------------|
| **Setup** | Copy JSON config | Copy JSON config | One command |
| **Transport** | stdio (Docker) | stdio or HTTP | stdio or HTTP |
| **Docker Required** | Optional | Optional | No |
| **Integration** | Native | Copilot Chat | Via MCP client |
| **Multi-Client** | No | No (stdio) / Yes (HTTP) | No (stdio) / Yes (HTTP) |
| **Production Use** | Yes | Yes | Yes |

> **For production multi-client deployments**, use the [Docker Compose setup](../docker/README.md) with HTTPS transport and connect any of the clients above via HTTP.

## Which Should I Choose?

**I want to chat with an AI about my containers →** [Claude Desktop](./claude/)

**I want Komodo tools in my IDE →** [VS Code](./vscode/)

**I want to run without Docker →** [Node.js / npx](./node/)

**I want a persistent server for multiple clients →** [Docker Compose](../docker/README.md)

## Prerequisites

All integrations require:

1. **Komodo** v2.0.0+ running and accessible
2. **Credentials** — one of:
   - API Key + Secret (recommended)
   - Username + Password
   - JWT Token (from browser SSO)
3. **Network access** from your machine to the Komodo Core server

For the full configuration reference (all environment variables, config file options, Docker secrets), see the [Configuration Guide](../config/README.md).

## Troubleshooting

### Cannot connect to Komodo

- Verify the server URL includes the protocol (`https://` or `http://`)
- Check network/firewall access
- Test connectivity: `curl -k $KOMODO_URL/health`

### Authentication fails

- Verify credentials are correct
- Ensure the user has proper permissions in Komodo
- For API keys, check they haven't expired

### Docker container issues

- Ensure Docker is running: `docker info`
- Pull the latest image: `docker pull ghcr.io/mp-tool/komodo-mcp-server:latest`

## More Info

- [Main Documentation](../README.md)
- [Configuration Reference](../config/README.md)
- [Docker Deployment](../docker/README.md)
