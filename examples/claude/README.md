# Claude Desktop Integration

Use the Komodo MCP Server with Claude Desktop to manage containers and deployments through AI conversations.

## Quick Setup

**1. Locate your Claude config file:**

- **macOS:** `~/Library/Application\ Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

**2. Add the MCP server configuration:**

Copy the content from [`claude_desktop_config.json`](./claude_desktop_config.json) in this folder to your Claude config file.

**3. Update credentials:**

Edit the `env` section in your config:
```json
"env": {
  "KOMODO_URL": "https://your-komodo-server.com:9120",
  "KOMODO_USERNAME": "your-username",
  "KOMODO_PASSWORD": "your-password"
}
```

**4. Pull the Docker image:**

```bash
docker pull ghcr.io/mp-tool/komodo-mcp-server:latest
```

**5. Restart Claude Desktop:**

Completely quit Claude (Cmd+Q on Mac, Alt+F4 on Windows) and restart.

## Configuration

### Docker Mode (Recommended)

The provided config uses Docker mode:

```json
{
  "mcpServers": {
    "komodo-mcp-server": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "ghcr.io/mp-tool/komodo-mcp-server:latest"],
      "env": {
        "KOMODO_URL": "https://your-server.com:9120",
        "KOMODO_USERNAME": "your-username",
        "KOMODO_PASSWORD": "your-password"
      }
    }
  }
}
```

**Benefits:**
- No local build required
- Isolated environment
- Always up-to-date with latest image

### Node.js Mode (Alternative)

For local development:

```json
{
  "mcpServers": {
    "komodo-mcp-server": {
      "command": "node",
      "args": ["/path/to/komodo-mcp-server/build/index.js"],
      "env": {
        "KOMODO_URL": "https://...",
        "KOMODO_USERNAME": "...",
        "KOMODO_PASSWORD": "..."
      }
    }
  }
}
```

**Requirements:**
- Local build: `npm run build`
- Node.js 22+ installed

## Usage

Once configured, you can ask Claude:

- "List all Komodo servers"
- "Show containers on production-server"
- "Start the nginx container on dev-server"
- "Deploy my-app to staging"
- "Get server stats for prod-server"
- "What's the status of the web container?"

### Verify It's Working

1. Open Claude Desktop
2. Look for the Tools section in the sidebar (under the chat input)
3. Click it to see available MCP tools
4. You should see Komodo tools listed
5. Try: "List my Komodo servers"

## Troubleshooting

### MCP server not showing up

**Solution:**
- Check config file syntax (must be valid JSON)
- Verify file location is correct for your OS
- Completely restart Claude (Quit, not just close window)
- Check Claude logs: `~/Library/Logs/Claude/` (macOS)

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
- Test Komodo connection independently first
- Verify URL format (include protocol: `https://` or `http://`)
- Check firewall/network access to Komodo server
- Ensure user has proper permissions in Komodo

### Tools appear but fail to execute

**Solution:**
- Check Claude logs for detailed errors
- Verify Komodo server is reachable from your machine
- Test credentials with `curl` or browser
- Ensure Komodo v1.19.5+ for username/password auth

## More Info

- [Main Documentation](../../README.md)
- [All Examples](../README.md)
- [Komodo](https://komo.do)
- [Claude Desktop](https://claude.ai/download)
