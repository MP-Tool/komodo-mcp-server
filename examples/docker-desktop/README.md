# Docker Desktop Integration

Use the Komodo MCP Server with Docker Desktop's built-in MCP support to manage containers directly from Docker Desktop's AI assistant.

**Note:** This is a beta feature in Docker Desktop 4.34+ and requires manual setup.

## Quick Setup

**1. Enable Beta Features:**

Docker Desktop → Settings → Features in development → Enable "MCP Server Support"

**2. Create MCP directory:**

```bash
mkdir -p ~/.docker/mcp/catalogs
```

**3. Copy catalog file:**

```bash
cp catalog.yaml ~/.docker/mcp/catalogs/komodo-mcp-server.yaml
```

**4. Register in registry:**

Create or edit `~/.docker/mcp/registry.yaml`:

```yaml
registry:
  komodo-mcp-server:
    ref: ""
```

**5. Pull the image:**

```bash
docker pull ghcr.io/mp-tool/komodo-mcp-server:latest
```

**6. Restart Docker Desktop:**

Completely quit and restart Docker Desktop for changes to take effect.

## Configuration

### File Structure

After setup, your Docker MCP directory should look like:

```
~/.docker/mcp/
├── registry.yaml              # Lists all MCP servers
└── catalogs/
    └── komodo-mcp-server.yaml # Komodo MCP server catalog
```

### Environment Variables

Edit `~/.docker/mcp/catalogs/komodo-mcp-server.yaml` and update the `env` section:

```yaml
env:
  KOMODO_URL: https://your-komodo-server.com:9120
  KOMODO_USERNAME: your-username
  KOMODO_PASSWORD: your-password
```

Or configure through Docker Desktop UI if available.

### Catalog Contents

The [`catalog.yaml`](./catalog.yaml) defines:

- **Server metadata** (name, description, version)
- **Docker image** to use
- **Environment variables** for configuration
- **Available tools** (13 MCP tools)

### Prerequisites

- Docker Desktop 4.34 or later
- Beta features enabled
- Active Komodo Container Manager instance
- Network access to Komodo server

## Usage

Once configured, use Docker Desktop's AI assistant:

- "Show my Komodo servers"
- "List containers on production-server"
- "Start the nginx container"
- "Deploy my-app to staging"
- "Get stats for dev-server"
- "What deployments are available?"

### Verify It's Working

1. Open Docker Desktop
2. Look for AI/Chat section
3. You should see "Komodo MCP Server" listed in available tools
4. Try: "List my Komodo servers"
5. Should return your configured servers

## Troubleshooting

### Server not showing up

**Solution:**
- Verify `~/.docker/mcp/registry.yaml` includes `komodo-mcp-server`
- Check catalog file exists: `ls ~/.docker/mcp/catalogs/`
- Ensure catalog filename matches registry entry
- Restart Docker Desktop completely (Quit → Reopen)

### Docker image not found

**Solution:**
```bash
# Pull the image
docker pull ghcr.io/mp-tool/komodo-mcp-server:latest

# Verify it exists
docker images | grep komodo-mcp-server
```

### Credentials not working

**Solution:**
- Verify environment variables in catalog.yaml
- Test Komodo connection: `curl -k $KOMODO_URL/health`
- Check firewall/network access
- Ensure Komodo v1.19.5+ for password auth

### Tools fail to execute

**Solution:**
- Check Docker Desktop logs for MCP errors
- Verify catalog YAML syntax is valid
- Test image manually: `docker run --rm -i ghcr.io/mp-tool/komodo-mcp-server:latest`
- Ensure environment variables are set correctly

### Beta feature issues

**Solution:**
- Update to Docker Desktop 4.34+
- Re-enable MCP Server Support in settings
- Check Docker Desktop release notes for known issues
- Consider using [Claude Desktop](../claude/) or [VS Code](../vscode/) integration instead

## Limitations

**Current Beta Limitations:**
- Manual catalog setup required (no Docker Hub integration yet)
- Limited UI for MCP server management
- Beta features may change in future releases
- Not all Docker Desktop features support MCP yet

**Alternatives:**
- [Claude Desktop](../claude/) - More mature MCP integration
- [VS Code](../vscode/) - IDE-integrated experience
- [Docker Compose](../compose/) - Standalone deployment

## More Info

- [Main Documentation](../../README.md)
- [All Examples](../README.md)
- [Docker Desktop MCP Docs](https://docs.docker.com/desktop/mcp/)
- [Model Context Protocol](https://modelcontextprotocol.io)
