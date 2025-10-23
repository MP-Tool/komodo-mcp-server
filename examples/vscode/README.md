# VS Code Integration

Use the Komodo MCP Server directly in VS Code with GitHub Copilot Chat to manage containers through AI-assisted development.

## Quick Setup

### Option 1: Global Integration (All Projects)

**1. Create MCP directory and copy config:**

```bash
# macOS/Linux
mkdir -p ~/.vscode/mcp
cp mcp.json ~/.vscode/mcp/

# Windows
mkdir %APPDATA%\Code\User\globalStorage\mcp
copy mcp.json %APPDATA%\Code\User\globalStorage\mcp\
```

**2. Edit credentials:**

Open `~/.vscode/mcp/mcp.json` and update the `env` section:
```json
"env": {
  "KOMODO_URL": "https://your-komodo-server.com:9120",
  "KOMODO_USERNAME": "your-username",
  "KOMODO_PASSWORD": "your-password"
}
```

**3. Restart VS Code:**

The Komodo MCP Server will now be available in all projects!

### Option 2: Local Integration (Single Project)

**1. Copy to your project:**

```bash
# In your project root
mkdir -p .vscode
cp mcp.json .vscode/
```

**2. Edit credentials:**

Update `.vscode/mcp.json` with your Komodo connection details.

**3. Reload VS Code window:**

Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux) → "Developer: Reload Window"

**Note:** Add `.vscode/mcp.json` to `.gitignore` to avoid committing credentials!

## Configuration

The [`mcp.json`](./mcp.json) includes both Docker and Node.js modes:

### Docker Mode (Recommended)

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
- Easy updates (`docker pull`)

### Node.js Mode (Alternative)

```json
{
  "mcpServers": {
    "komodo-mcp-server": {
      "command": "node",
      "args": ["build/index.js"],
      "env": {
        "KOMODO_URL": "...",
        "KOMODO_USERNAME": "...",
        "KOMODO_PASSWORD": "..."
      }
    }
  }
}
```

**Requirements:**
- Local build: `npm run build`
- Faster startup (no Docker overhead)

**Tip:** Comment out the mode you don't use in `mcp.json`.

## Usage

Open GitHub Copilot Chat in VS Code and try:

- "List all Komodo servers"
- "Show containers on dev-server"
- "Start the nginx container"
- "Deploy my-app to staging"
- "Get server stats for production"
- "What deployments are available?"

### Verify It's Working

1. Open VS Code
2. Open Copilot Chat (Ctrl+Alt+I or Cmd+Alt+I)
3. Type: `@workspace list my Komodo servers`
4. You should see MCP tools responding with server list

## Troubleshooting

### Server not showing up

**Solution:**
- Check VS Code Output panel: View → Output → select "MCP" from dropdown
- Verify config file location and syntax (valid JSON)
- Check credentials are correctly set
- Restart VS Code completely

### Docker mode fails

**Solution:**
```bash
# Pull the image
docker pull ghcr.io/mp-tool/komodo-mcp-server:latest

# Verify Docker is running
docker ps

# Test the image
docker run --rm -i ghcr.io/mp-tool/komodo-mcp-server:latest
```

### Node.js mode fails

**Solution:**
```bash
# Build the project first
cd /path/to/komodo-mcp-server
npm run build

# Verify path in mcp.json is correct
# Should point to: build/index.js
```

### Tools work but commands fail

**Solution:**
- Verify Komodo server is reachable
- Test credentials with curl or browser
- Check firewall/network access
- Ensure Komodo v1.19.5+ for password auth

### Local vs Global config conflict

**Solution:**
- Local config (`.vscode/mcp.json`) overrides global
- Remove local config if you want global to apply
- Or use local for project-specific servers

## More Info

- [Main Documentation](../../README.md)
- [All Examples](../README.md)
- [VS Code MCP Documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [GitHub Copilot](https://github.com/features/copilot)
