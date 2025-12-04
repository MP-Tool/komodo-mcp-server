# VS Code Integration

Use the Komodo MCP Server directly in VS Code with GitHub Copilot Chat to manage your infrastructure.

## 🚀 Quick Start

### Prerequisites
- [VS Code](https://code.visualstudio.com/) installed.
- [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) extension installed.
- [Docker](https://www.docker.com/) installed and running.

### 1. Locate Configuration File
Open your global VS Code MCP configuration file:

- **macOS/Linux:** `~/Library/Application Support/Code/User/globalStorage/mcp-servers.json`
- **Windows:** `%APPDATA%\Code\User\globalStorage\mcp-servers.json`

*Note: If the file doesn't exist, create it, or use local workspace settings by adding a `.vscode/mcp.json` file.*

### 2. Add Configuration
Add the Komodo MCP server to the configuration.

#### Connect to Self-Hosted (SSE)
If you are running the server via Docker Compose (see [Compose Example](../compose/README.md)), you can connect via SSE.

```json
{
  "servers": {
    "komodo-sse": {
      "url": "http://localhost:3000/mcp"
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

## 📚 Official Documentation
For more details on configuring MCP in VS Code, please refer to the [official VS Code MCP documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers).

## More Info
- [Main Documentation](../../README.md)
- [All Examples](../README.md)
