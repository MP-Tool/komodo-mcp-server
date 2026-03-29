# Claude Desktop Integration

Use the Komodo MCP Server with Claude Desktop to manage your infrastructure directly from the chat interface.

## 🚀 Quick Start

The easiest way to use the Komodo MCP Server is to let Claude Desktop manage the Docker container for you.

### Prerequisites
- [Komodo](https://komo.do/) v2.0.0+ with API access enabled
- [Docker](https://www.docker.com/) must be installed and running.
- [Claude Desktop](https://claude.ai/download) must be installed.

### 1. Locate Configuration File
Open the configuration file for Claude Desktop on your computer:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

If the file doesn't exist, create it. You can also navigate through the Claude Desktop UI to locate the configuration file:
  
  Open Claude Desktop → Settings → Developer → Edit Config

### 2. Add Configuration
Copy the following configuration into the file. You can also download our [template](./claude_desktop_config.json) and copy it to the folder.

```json
"komodo-mcp-server": {
  "command": "docker",
  "args": [
    "run",
    "-i",
    "--rm",
    "-e", "MCP_TRANSPORT=stdio",
    "-e", "KOMODO_URL=https://komodo.example.com:9120",
    "-e", "KOMODO_API_KEY=api-key",
    "-e", "KOMODO_API_SECRET=api-secret",
    "ghcr.io/mp-tool/komodo-mcp-server:latest"
  ]
}
```

Note: If you are running the MCP server and Komodo in the same Docker environment, you can use `host.docker.internal` to connect to Komodo. In that case, set `KOMODO_URL=https://host.docker.internal:9120`.

**Important:** Replace `KOMODO_URL`, `KOMODO_API_KEY`, and `KOMODO_API_SECRET` with your actual Komodo credentials.

> **Alternative auth methods:** You can use `KOMODO_USERNAME`/`KOMODO_PASSWORD` or `KOMODO_JWT_TOKEN` instead of API Key/Secret.

### 3. Restart Claude
Completely quit and restart Claude Desktop. You should now see the `Komodo MCP Server` under the connectors tab with an enable toggle. Enable it and you should be good to go!

## 📚 Official Documentation
For more details on configuring MCP in Claude Desktop, please refer to the [official Claude MCP documentation](https://modelcontextprotocol.io/docs/develop/connect-local-servers#installing-the-filesystem-server).

## 🔧 Troubleshooting
- **Connection Failed**: Ensure Docker is running and check the logs in Claude Desktop and the Docker container.
- **Authentication Error**: Verify your credentials (API key/secret, username/password, or JWT token) are correct.
- **Network Issues**: If your Komodo server is on a local network, ensure the Docker container can reach it.

## More Info
- [Main Documentation](../../README.md)
- [Configuration Reference](../../config/README.md)
- [All Integrations](../README.md)
