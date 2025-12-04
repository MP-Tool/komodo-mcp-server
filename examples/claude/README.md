# Claude Desktop Integration

Use the Komodo MCP Server with Claude Desktop to manage your infrastructure directly from the chat interface.

## 🚀 Quick Start

The easiest way to use the Komodo MCP Server is to let Claude Desktop manage the Docker container for you.

### Prerequisites
- [Docker](https://www.docker.com/) must be installed and running.
- [Claude Desktop](https://claude.ai/download) must be installed.

### 1. Locate Configuration File
Open the configuration file for Claude Desktop on your computer:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

If the file doesn't exist, create it.

### 2. Add Configuration
Copy the following configuration into the file. You can also download our [template](./claude_desktop_config.json) and copy it to the folder.

```json
"komodo-mcp-server": {
  "command": "docker",
  "args": [
    "run",
    "--rm",
    "-i",
    "-e", "MCP_TRANSPORT=stdio",
    "-e", "KOMODO_URL=https://your-komodo-server.com:9120",
    "-e", "KOMODO_USERNAME=your-username",
    "-e", "KOMODO_PASSWORD=your-password",
    "ghcr.io/mp-tool/komodo-mcp-server:latest"
  ]
}
```

**Important:** Replace `KOMODO_URL`, `KOMODO_USERNAME`, and `KOMODO_PASSWORD` with your actual Komodo credentials.

### 3. Restart Claude
Completely quit and restart Claude Desktop. You should now see in the tool's list, below the websearch toggle, the `Komodo MCP Server` and its available tools.

## 📚 Official Documentation
For more details on configuring MCP in Claude Desktop, please refer to the [official Claude MCP documentation](https://modelcontextprotocol.io/docs/develop/connect-local-servers#installing-the-filesystem-server).

## 🔧 Troubleshooting
- **Connection Failed**: Ensure Docker is running.
- **Authentication Error**: Check your username and password in the config file.
- **Network Issues**: If your Komodo server is on a local network, ensure the Docker container can reach it (you might need `--network host` on Linux, or use `host.docker.internal` on macOS/Windows).

## More Info
- [Main Documentation](../../README.md)
- [All Examples](../README.md)
