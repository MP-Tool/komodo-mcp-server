# 🐳 Docker Compose Deployment

Run the Komodo MCP Server as a standalone container using Docker Compose. This setup is ideal for:

- **Production environments** – Persistent, always-on MCP server
- **Remote access** – Connect from any MCP-compatible client over HTTP
- **Running alongside Komodo** – Deploy in the same network/stack
- **n8n integration** – Use as MCP backend for automation workflows

## 📋 Prerequisites

- **Docker** with Compose v2 (included in Docker Desktop)
- **Komodo** v1.19.5+ with API access enabled
- **API credentials** – API Key/Secret (recommended) or Username/Password

## 🚀 Quick Start

### 1. Download Files

```bash
# Create directory
mkdir komodo-mcp && cd komodo-mcp

# Download files
curl -O https://raw.githubusercontent.com/MP-Tool/komodo-mcp-server/main/examples/compose/compose.yaml
curl -O https://raw.githubusercontent.com/MP-Tool/komodo-mcp-server/main/examples/compose/.env.example
```

Or clone the repository:

```bash
git clone https://github.com/MP-Tool/komodo-mcp-server.git
cd komodo-mcp-server/examples/compose
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Komodo credentials:

```dotenv
# Komodo Server URL
KOMODO_URL=https://komodo.example.com:9120

# Authentication (choose one)
# Option A: API Key (Recommended)
KOMODO_API_KEY=your-api-key
KOMODO_API_SECRET=your-api-secret

# Option B: Username/Password
# KOMODO_USERNAME=mcp-user
# KOMODO_PASSWORD=your-password
```

### 3. Start the Server

```bash
docker compose up -d
```

### 4. Verify

```bash
# Check status
docker compose ps

# View logs
docker compose logs -f

# Test health endpoint
curl http://localhost:3000/health
```

## 🔌 Connecting MCP Clients

### HTTP Transport (Recommended)

Most MCP clients support the Streamable HTTP transport:

| Endpoint | Description |
|----------|-------------|
| `http://localhost:3000/mcp` | MCP Streamable HTTP endpoint |
| `http://localhost:3000/sse` | Legacy SSE endpoint (if enabled) |
| `http://localhost:3000/health` | Health check (always 200) |
| `http://localhost:3000/ready` | Readiness check (200/503) |

### Claude Desktop

Claude Desktop requires `stdio` transport. For Docker-based setup, use:

```json
{
  "mcpServers": {
    "komodo": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "KOMODO_URL=https://komodo.example.com:9120",
        "-e", "KOMODO_API_KEY=your-api-key",
        "-e", "KOMODO_API_SECRET=your-api-secret",
        "-e", "MCP_TRANSPORT=stdio",
        "ghcr.io/mp-tool/komodo-mcp-server:latest"
      ]
    }
  }
}
```

👉 See [Claude Desktop Guide](../claude/README.md) for detailed instructions.

### VS Code / GitHub Copilot

```json
{
  "servers": {
    "komodo": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

👉 See [VS Code Guide](../vscode/README.md) for detailed instructions.

### MCP Inspector (Testing)

Test your setup with the official MCP Inspector:

```bash
npx @modelcontextprotocol/inspector --url http://localhost:3000/mcp
```

## ⚙️ Configuration Reference

All configuration is done via environment variables. See [`.env.example`](./.env.example) for the complete reference with descriptions.

### Essential Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KOMODO_URL` | ✅ | Komodo server URL |
| `KOMODO_API_KEY` | ✅* | API Key for authentication |
| `KOMODO_API_SECRET` | ✅* | API Secret for authentication |
| `KOMODO_USERNAME` | ✅* | Username (alternative to API Key) |
| `KOMODO_PASSWORD` | ✅* | Password (alternative to API Key) |

*Either API Key/Secret OR Username/Password required

### Transport & Network

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `http` | Transport mode: `http` or `stdio` |
| `MCP_PORT` | `3000` | HTTP server port |
| `MCP_BIND_HOST` | `0.0.0.0` | Bind address |
| `MCP_LEGACY_SSE_ENABLED` | `false` | Enable legacy SSE transport |
| `MCP_ALLOWED_ORIGINS` | `*` | CORS allowed origins |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Log verbosity: `trace`, `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | `text` | Output format: `text` or `json` |

## 🔒 Security Best Practices

### Use API Keys

API Keys are preferred over username/password:

- Can be rotated without changing user credentials
- Can have limited permissions
- Better audit trail in Komodo

### Reverse Proxy

TODO: Example

## 🩺 Health Checks

The container includes built-in health monitoring:

| Endpoint | Status | Meaning |
|----------|--------|---------|
| `/health` | `200` | Server is running |
| `/ready` | `200` | Connected to Komodo, ready for requests |
| `/ready` | `503` | Not connected to Komodo |
| `/ready` | `429` | Server overloaded |

Docker Compose automatically monitors `/ready` and restarts unhealthy containers.

## 📊 Observability (Optional)

Enable OpenTelemetry for distributed tracing:

```dotenv
OTEL_ENABLED=true
OTEL_SERVICE_NAME=komodo-mcp-server
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
```

Compatible backends: Jaeger, Grafana Tempo, OpenTelemetry Collector

## 🔧 Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs komodo-mcp-server
```

### Connection to Komodo fails

```bash
# Test from inside the container
docker compose exec komodo-mcp-server wget -qO- https://komodo.example.com:9120/health

# If running Komodo locally in Docker, use:
KOMODO_URL=http://host.docker.internal:9120
```

### Health check failing

```bash
# Check readiness
curl http://localhost:3000/ready

# 503 = Komodo not connected
# Check KOMODO_URL and credentials
```

## 📚 More Resources

- [Main Documentation](../../README.md)
- [VS Code Integration](../vscode/README.md)
- [Claude Desktop Integration](../claude/README.md)
- [Komodo Documentation](https://komo.do/docs)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
