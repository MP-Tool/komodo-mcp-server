# NPM / Node.js Integration

Run the Komodo MCP Server directly with Node.js — no Docker required. Perfect for **Windows**, **macOS**, and **Linux** users who prefer a native installation.

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v22 or later installed

### Option 1: npx (No Installation)

Run directly without installing:

```bash
# Set environment variables and run
KOMODO_URL=https://komodo.example.com:9120 \
KOMODO_API_KEY=api-key \
KOMODO_API_SECRET=api-secret \
npx komodo-mcp-server
```

### Option 2: Global Installation

Install globally for repeated use:

```bash
npm install -g komodo-mcp-server

# Then run with environment variables
KOMODO_URL=https://komodo.example.com:9120 \
KOMODO_API_KEY=api-key \
KOMODO_API_SECRET=api-secret \
komodo-mcp-server
```

---

## 🖥️ Platform-Specific Instructions

### Linux / macOS

```bash
# Using export (persistent in session)
export KOMODO_URL=https://komodo.example.com:9120
export KOMODO_API_KEY=api-key
export KOMODO_API_SECRET=api-secret
npx komodo-mcp-server

# Or inline (one-time)
KOMODO_URL=https://komodo.example.com:9120 KOMODO_API_KEY=api-key KOMODO_API_SECRET=api-secret npx komodo-mcp-server
```

### Windows (PowerShell)

```powershell
# Set environment variables
$env:KOMODO_URL = "https://komodo.example.com:9120"
$env:KOMODO_API_KEY = "api-key"
$env:KOMODO_API_SECRET = "api-secret"

# Run the server
npx komodo-mcp-server
```

### Windows (Command Prompt)

```cmd
set KOMODO_URL=https://komodo.example.com:9120
set KOMODO_API_KEY=api-key
set KOMODO_API_SECRET=api-secret
npx komodo-mcp-server
```

---

## 🔐 Authentication Options

You can authenticate using either **API Keys** (recommended) or **Username/Password**:

### API Key Authentication (Recommended)

```bash
export KOMODO_URL=https://komodo.example.com:9120
export KOMODO_API_KEY=api-key
export KOMODO_API_SECRET=api-secret
```

### Username/Password Authentication

```bash
export KOMODO_URL=https://komodo.example.com:9120
export KOMODO_USERNAME=your-username
export KOMODO_PASSWORD=your-password
```

---

## ⚙️ Configuration Options

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KOMODO_URL` | ✅ | - | Komodo Core server URL |
| `KOMODO_API_KEY` | ✅* | - | API key for authentication |
| `KOMODO_API_SECRET` | ✅* | - | API secret for authentication |
| `KOMODO_USERNAME` | ✅* | - | Username (alternative to API key) |
| `KOMODO_PASSWORD` | ✅* | - | Password (alternative to API key) |
| `MCP_TRANSPORT` | ❌ | `stdio` | Transport mode: `stdio` or `http` |
| `MCP_PORT` | ❌ | `8000` | HTTP port (when using http transport) |
| `LOG_LEVEL` | ❌ | `info` | Log level: `debug`, `info`, `warn`, `error` |

*\* Either API Key/Secret OR Username/Password is required*

For all available configuration options, see the [Configuration Guide](../../config/README.md).

---

## 🔌 Integration with MCP Clients

### Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS/Linux:**
```json
{
  "mcpServers": {
    "komodo-mcp-server": {
      "command": "npx",
      "args": ["komodo-mcp-server"],
      "env": {
        "KOMODO_URL": "https://komodo.example.com:9120",
        "KOMODO_API_KEY": "api-key",
        "KOMODO_API_SECRET": "api-secret"
      }
    }
  }
}
```

**Windows:**
```json
{
  "mcpServers": {
    "komodo-mcp-server": {
      "command": "npx.cmd",
      "args": ["komodo-mcp-server"],
      "env": {
        "KOMODO_URL": "https://komodo.example.com:9120",
        "KOMODO_API_KEY": "api-key",
        "KOMODO_API_SECRET": "api-secret"
      }
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json` or global settings:

```json
{
  "servers": {
    "Komodo MCP Server": {
      "command": "npx",
      "args": ["komodo-mcp-server"],
      "env": {
        "KOMODO_URL": "https://komodo.example.com:9120",
        "KOMODO_API_KEY": "api-key",
        "KOMODO_API_SECRET": "api-secret"
      }
    }
  }
}
```

---

## 🌐 HTTP Mode (Server Mode)

Run as a persistent HTTP server for remote connections:

```bash
export KOMODO_URL=https://komodo.example.com:9120
export KOMODO_API_KEY=api-key
export KOMODO_API_SECRET=api-secret
export MCP_TRANSPORT=http
export MCP_PORT=8000

npx komodo-mcp-server
```

Then connect your MCP client to: `http://localhost:8000/mcp`

---

## 🔧 Troubleshooting

### "command not found: npx"
Make sure Node.js is installed and in your PATH:
```bash
node --version  # Should show v22.x or later
npm --version   # Should show npm version
```

### "Connection refused" / "Authentication failed"
- Verify your `KOMODO_URL` is correct and reachable
- Check API key/secret or username/password credentials
- Ensure your Komodo Core server is running

### Windows: "npx is not recognized"
Use the full path or run from Node.js command prompt:
```powershell
# Find npx location
where.exe npx

# Or use npx.cmd explicitly
npx.cmd komodo-mcp-server
```

---

## More Info
- [Main Documentation](../../README.md)
- [Configuration Reference](../../config/README.md)
- [All Integrations](../README.md)
- [npm Package](https://www.npmjs.com/package/komodo-mcp-server)
