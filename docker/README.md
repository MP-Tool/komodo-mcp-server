# 🐳 Docker Compose Deployment

Run the Komodo MCP Server as a standalone container using Docker Compose. This setup is ideal for:

- **Production environments** – Persistent, always-on MCP server
- **Remote access** – Connect from any MCP-compatible client over HTTP
- **Running alongside Komodo** – Deploy in the same network/stack
- **Automation & integration** – Use as MCP backend for automation workflows

## 📋 Prerequisites

- **Docker** with Compose v2 (included in Docker Desktop)
- **Komodo** v2.0.0+ with API access enabled
- **API credentials** – API Key/Secret (recommended) or Username/Password

## 🚀 Quick Start

### 1. Download Files

```bash
# Create directory
mkdir komodo-mcp && cd komodo-mcp

# Download files
curl -O https://raw.githubusercontent.com/MP-Tool/komodo-mcp-server/main/docker/compose.yaml
curl -O https://raw.githubusercontent.com/MP-Tool/komodo-mcp-server/main/docker/docker.env
```

Or clone the repository:

```bash
git clone https://github.com/MP-Tool/komodo-mcp-server.git
cd komodo-mcp-server/docker
```

### 2. Configure Environment

```bash
cp docker.env .env
```

Edit `.env` with your Komodo credentials:

```dotenv
## Komodo Server URL
KOMODO_URL=https://komodo.example.com:9120

## Authentication (choose one)
## Option A: API Key (Recommended)
KOMODO_API_KEY=api-key
KOMODO_API_SECRET=api-secret

## Option B: Username/Password
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
curl http://komodo-mcp.example.com:8000/health
```

---

## 🔌 Connecting MCP Clients

### HTTP Transport

Most MCP clients support the Streamable HTTP transport:

| Endpoint | Description |
|----------|-------------|
| `http://komodo-mcp.example.com:8000/mcp` | MCP Streamable HTTP endpoint |
| `http://komodo-mcp.example.com:8000/sse` | Legacy SSE endpoint (if enabled) |
| `http://komodo-mcp.example.com:8000/health` | Health check (always 200) |
| `http://komodo-mcp.example.com:8000/ready` | Readiness check (200/503) |

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
        "-e", "KOMODO_API_KEY=api-key",
        "-e", "KOMODO_API_SECRET=api-secret",
        "-e", "MCP_TRANSPORT=stdio",
        "ghcr.io/mp-tool/komodo-mcp-server:latest"
      ]
    }
  }
}
```

👉 See [Claude Desktop Guide](../examples/claude/README.md) for detailed instructions.

### VS Code / GitHub Copilot

```json
{
  "servers": {
    "komodo": {
      "type": "http",
      "url": "http://komodo-mcp.example.com:8000/mcp"
    }
  }
}
```

👉 See [VS Code Guide](../examples/vscode/README.md) for detailed instructions.

### MCP Inspector (Testing)

If you like, test your setup with the official MCP Inspector:

```bash
npx @modelcontextprotocol/inspector --url http://komodo-mcp.example.com:8000/mcp
```

## ⚙️ Configuration

The server has solid defaults, so in many cases you only need to set the Komodo connection and credentials. However, there are many additional options for configuring transport, security, logging, and more. You can set these via environment variables, in the config file in your preferred file format (TOML, JSON, YAML), or using Docker secrets for sensitive information. Environment variables take precedence over config file settings.

The MCP server looks automatically for a config file (`config.toml`|`config.yaml`|`config.json`) in the root of the run directory, in the docker container it will be the `/app` directory. You can also specify a custom path to your config file with `MCP_CONFIG_PATH`.

For the complete configuration reference (all variables, config file formats, priority chain, Docker secrets), see the **[Configuration Guide](../config/README.md)**.

### Essential Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KOMODO_URL` | ✅ | Komodo server URL |
| `KOMODO_API_KEY` | ✅* | API Key for authentication |
| `KOMODO_API_SECRET` | ✅* | API Secret for authentication |
| `KOMODO_USERNAME` | ✅* | Username (alternative to API Key) |
| `KOMODO_PASSWORD` | ✅* | Password (alternative to API Key) |

*Either API Key/Secret OR Username/Password required

### Key Docker Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `http` | Transport mode (`http`, `https`, or `stdio`) |
| `MCP_PORT` | `8000` | HTTP server port (8443 for HTTPS) |
| `MCP_BIND_HOST` | `0.0.0.0` | Bind address |
| `TZ` | - | Timezone RFC3339 format (default inherits from host) |
| `LOG_LEVEL` | `info` | Log verbosity: `error`, `warn`, `info`, `debug`, `trace` |

## 🔒 Security Best Practices

### Use API Keys

API Keys are preferred over username/password:

- Can be rotated without changing user credentials
- Can have limited permissions
- Better audit trail in Komodo

### Use TLS

The server supports TLS natively (`MCP_TRANSPORT=https`) or via a reverse proxy.

#### Built-in TLS

Set `MCP_TRANSPORT=https` and provide certificate paths:

```dotenv
MCP_TRANSPORT=https
MCP_TLS_CERT_PATH=/certs/server.crt
MCP_TLS_KEY_PATH=/certs/server.key
```

Mount the certificates as volumes in your `compose.yaml`.

#### Reverse Proxy

For production, a reverse proxy (nginx, Traefik, Caddy) is recommended for TLS termination, load balancing, and additional security layers. The MCP server runs on HTTP behind the proxy.

When using a reverse proxy, configure the trust proxy setting:

```dotenv
MCP_TRUST_PROXY=loopback
```

See the [Configuration Guide](../config/README.md) for all security-related settings (rate limiting, CORS, allowed hosts, Helmet headers).

## 🩺 Health Checks

The container includes built-in health monitoring:

| Endpoint | Status | Meaning |
|----------|--------|---------|
| `/health` | `200` | Server is running |
| `/ready` | `200` | Connected to Komodo, ready for requests |
| `/ready` | `503` | Not connected to Komodo |
| `/ready` | `429` | Server overloaded |

Docker Compose automatically monitors `/ready` and can restart unhealthy containers.

## 📊 Observability (Experimental)

Enable OpenTelemetry for distributed tracing:

```dotenv
OTEL_ENABLED=true
OTEL_SERVICE_NAME=komodo-mcp-server
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
```

Compatible backends: Jaeger, Grafana Tempo, OpenTelemetry Collector

Note: Observability features are experimental and may impact performance. Use in production with caution. Also this feature is not yet fully tested and documented, so expect some rough edges.

## 🔧 Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs komodo-mcp-server
```

### Connection to Komodo fails

```bash
# Test from inside the container
docker compose exec komodo-mcp-server node -e "fetch('https://komodo.example.com:9120/health').then(async r=>console.log(await r.text())).catch(console.error)"

# If running Komodo and the mcp server in the same Docker environment, you can use:
KOMODO_URL=https://host.docker.internal:9120
```

## 📚 More Resources

- [Main Documentation](../README.md)
- [Configuration Reference](../config/README.md)
- [Client Integrations](../examples/README.md)
- [VS Code Integration](../examples/vscode/README.md)
- [Claude Desktop Integration](../examples/claude/README.md)
- [Komodo Documentation](https://komo.do/docs)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
