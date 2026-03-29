# VS Code Integration

Use the Komodo MCP Server directly in VS Code with GitHub Copilot Chat to manage your infrastructure.

## 🚀 Quick Start

### Prerequisites
- [Komodo](https://komo.do/) v2.0.0+ with API access enabled
- [Docker](https://www.docker.com/) (for stdio transport option)
- [VS Code](https://code.visualstudio.com/) installed
- [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) extension installed

### 1. Locate Configuration File
Open your global VS Code MCP configuration file:

- **macOS/Linux:** `~/Library/Application Support/Code/User/globalStorage/mcp-servers.json`
- **Windows:** `%APPDATA%\Code\User\globalStorage\mcp-servers.json`

*Alternatively, use local workspace settings by adding a `.vscode/mcp.json` file.*

### 2. Add Configuration

Choose one of the following configurations:

#### Option A: Docker with Stdio Transport

Runs the server as a Docker container using stdio transport — no network ports needed.

```json
{
  "servers": {
    "Komodo MCP Server": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "MCP_TRANSPORT=stdio",
        "-e", "KOMODO_URL=https://komodo.example.com:9120",
        "-e", "KOMODO_API_KEY=api-key",
        "-e", "KOMODO_API_SECRET=api-secret",
        "ghcr.io/mp-tool/komodo-mcp-server:latest"
      ]
    }
  }
}
```

> Requires [Docker](https://www.docker.com/) installed and running.

#### Option B: Connect via HTTP

If you are running the server via [Docker Compose](../../docker/README.md), connect to it over HTTP.

```json
{
  "servers": {
    "Komodo MCP Server": {
      "type": "http",
      "url": "http://komodo-mcp.example.com:8000/mcp"
    }
  }
}
```

#### Option C: Connect via HTTPS

For production setups with TLS enabled (see [Configuration](../../config/README.md#TLS)):

```json
{
  "servers": {
    "Komodo MCP Server": {
      "type": "http",
      "url": "https://komodo-mcp.example.com:8443/mcp"
    }
  }
}
```

### 3. Restart VS Code
Restart VS Code. You should now be able to ask Copilot to manage your containers!

**Example Prompts:**
- "List all my containers in Komodo"
- "Restart the 'web-app' container"
- "Show logs for the database"
- "Deploy the latest version of my-app"

## 🔐 Authentication

The server supports three authentication methods. Set them as environment variables, in your Docker Compose file, or in your config file. For the full configuration reference, see the [Configuration Guide](../../config/README.md).

| Method | Environment Variables |
|--------|----------------------|
| **API Key** (recommended) | `KOMODO_API_KEY`, `KOMODO_API_SECRET` |
| **Username/Password** | `KOMODO_USERNAME`, `KOMODO_PASSWORD` |
| **JWT Token** | `KOMODO_JWT_TOKEN` |

`KOMODO_URL` is always required.

## 📚 Official Documentation
For more details on configuring MCP in VS Code, refer to the [official VS Code MCP documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers).

## More Info
- [Main Documentation](../../README.md)
- [Configuration Reference](../../config/README.md)
- [All Integrations](../README.md)
