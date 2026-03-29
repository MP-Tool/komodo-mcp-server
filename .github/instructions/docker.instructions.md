---
applyTo: "**/Dockerfile,**/compose*.yaml,**/compose*.yml"
description: Docker and deployment guidelines
---

# Docker & Deployment Guidelines

## Docker Image

### Base Image

`node:22-alpine` with multi-stage build:
1. **Builder Stage**: Compiles TypeScript with devDependencies, prunes to production
2. **Development Stage**: For DevContainers — mounts workspace as volume, pre-installs dependencies
3. **Production Stage**: Only runtime dependencies, read-only artifacts

### Security

- **Non-Root User**: Built-in `node` user (UID 1000) with `/sbin/nologin` shell
- **Immutable Artifacts**: Build files owned by `root:root` (runtime user cannot modify)
- **Tini Init**: `/sbin/tini --` as entrypoint for proper signal handling (SIGTERM, SIGINT)
- **OS Upgrade**: `apk upgrade --no-cache` in every stage

### Health Check

Uses Node.js built-in `fetch()` — no wget/curl needed:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD if [ "$MCP_TRANSPORT" = "http" ] || [ "$MCP_TRANSPORT" = "https" ]; then \
    node -e "fetch('http://localhost:'+(process.env.MCP_PORT||8000)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; \
  else exit 0; fi
```

Skipped in stdio mode (always healthy).

### Multi-Arch Support

- linux/amd64, linux/arm64, linux/arm/v7
- Builder uses `--platform=$BUILDPLATFORM` to avoid QEMU emulation issues with npm

## Environment Variables

### Komodo Connection

| Variable | Default | Description |
|----------|---------|-------------|
| `KOMODO_URL` | — | Komodo Core API URL (e.g. `https://komodo.example.com`) |
| `KOMODO_USERNAME` | — | Username for login auth |
| `KOMODO_PASSWORD` | — | Password for login auth |
| `KOMODO_API_KEY` | — | API Key (alternative to username/password) |
| `KOMODO_API_SECRET` | — | API Secret (for API Key auth) |
| `KOMODO_JWT_TOKEN` | — | Pre-existing JWT token (OIDC, GitHub, Google OAuth) |
| `API_TIMEOUT_MS` | `"30s"` | Request timeout. Accepts durations (`"30s"`, `"1m"`) or ms (`30000`) |

### Docker Secrets (`_FILE` pattern)

All credential variables support a `_FILE` suffix for Docker secrets:

| Variable | Description |
|----------|-------------|
| `KOMODO_USERNAME_FILE` | Path to file containing the username |
| `KOMODO_PASSWORD_FILE` | Path to file containing the password |
| `KOMODO_API_KEY_FILE` | Path to file containing the API key |
| `KOMODO_API_SECRET_FILE` | Path to file containing the API secret |
| `KOMODO_JWT_TOKEN_FILE` | Path to file containing the JWT token |

```yaml
# compose.yaml example with Docker secrets
services:
  komodo-mcp:
    image: ghcr.io/mp-tool/komodo-mcp-server:latest
    secrets:
      - komodo_api_key
      - komodo_api_secret
    environment:
      KOMODO_URL: https://komodo.example.com
      KOMODO_API_KEY_FILE: /run/secrets/komodo_api_key
      KOMODO_API_SECRET_FILE: /run/secrets/komodo_api_secret

secrets:
  komodo_api_key:
    file: ./secrets/api_key.txt
  komodo_api_secret:
    file: ./secrets/api_secret.txt
```

### MCP Transport (Framework)

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `http` | `stdio` for CLI, `http` for network/Docker |
| `MCP_PORT` | `8000` | HTTP server port |
| `MCP_BIND_HOST` | `127.0.0.1` | Bind address (Docker: `0.0.0.0`) |
| `MCP_LEGACY_SSE_ENABLED` | `false` | Enable legacy SSE transport for older MCP clients |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | `trace`, `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | `text` | `text` or `json` (ECS format) |
| `LOG_DIR` | — | Optional directory for log files |

### OpenTelemetry (opt-in)

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_ENABLED` | `false` | Enable distributed tracing and metrics |
| `OTEL_SERVICE_NAME` | `mcp-server` | Service name for traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | OTLP endpoint (e.g. `http://localhost:4318`) |

## Deployment Checklist

- [ ] Environment variables set (at minimum `KOMODO_URL` + auth credentials)
- [ ] Health check responding on `/ready`
- [ ] Running as non-root user
- [ ] Secrets via `_FILE` pattern (not plain env vars in production)
- [ ] `MCP_BIND_HOST=0.0.0.0` set for Docker networking
