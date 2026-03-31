# Configuration Reference

Central reference for all configuration options of the Komodo MCP Server.

The server can be configured through **environment variables**, **config files** (TOML, YAML, JSON), or a combination of both. This guide covers the priority chain, all available options, and common patterns.

## Configuration Priority

The server follows the [12-Factor App](https://12factor.net/config) methodology. Configuration sources are merged top-down — **higher sources override lower ones**:

```
┌─────────────────────────────────┐  ← Highest priority
│   Environment Variables         │    (process.env, docker -e, compose environment:)
├─────────────────────────────────┤
│   Config File                   │    (config.toml / config.yaml / config.json)
├─────────────────────────────────┤
│   .env File                     │    (auto-loaded from working directory)
├─────────────────────────────────┤
│   Defaults                      │    (built-in defaults)
└─────────────────────────────────┘  ← Lowest priority
```

**Example:** If `LOG_LEVEL=debug` is set in `config.toml` but `LOG_LEVEL=warn` is set as an environment variable, the effective value is `warn`.

## Config File Formats

The server supports three config file formats. All are functionally equivalent — choose whichever you prefer.

| Format | Filename | Notes |
|--------|----------|-------|
| **TOML** | `config.toml` | Recommended — comments, readable, explicit types |
| **YAML** | `config.yaml` / `config.yml` | Familiar to Docker/Kubernetes users |
| **JSON** | `config.json` | No comments — least recommended |

### Auto-Discovery

When no explicit path is specified, the server searches the working directory for config files in this order:

```
config.toml → config.yaml → config.yml → config.json
```

The **first file found** is used. If none is found, the server runs with environment variables and defaults only.

### Explicit Path

Override auto-discovery by setting the config file path:

```bash
MCP_CONFIG_FILE_PATH=/path/to/my-config.toml
```

### Example Files

This directory contains complete reference configs with all available options documented:

| File | Description |
|------|-------------|
| [`example.config.toml`](./example.config.toml) | Full TOML reference (recommended) |
| [`example.config.yaml`](./example.config.yaml) | Full YAML reference |
| [`example.config.env`](./example.config.env) | Full environment variable reference |

Copy one of these as a starting point:

```bash
cp example.config.toml config.toml
# Edit config.toml with your settings
```

## Komodo Connection & Authentication

These settings configure the connection to your Komodo Core server.

### Connection

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `KOMODO_URL` | `komodo.url` | — | Komodo Core server URL (required) |
| `API_TIMEOUT_MS` | `komodo.api_timeout_ms` | `30000` | API request timeout in milliseconds |

### Authentication Methods

Choose **one** of three authentication methods:

#### API Key (Recommended)

Best for service accounts and automation. Can be rotated without changing user credentials.

| Variable | Config Key | Description |
|----------|-----------|-------------|
| `KOMODO_API_KEY` | `komodo.api_key` | API Key |
| `KOMODO_API_SECRET` | `komodo.api_secret` | API Secret |

#### Username / Password

For interactive users. Requires Komodo v2.0.0+.

| Variable | Config Key | Description |
|----------|-----------|-------------|
| `KOMODO_USERNAME` | `komodo.username` | Username |
| `KOMODO_PASSWORD` | `komodo.password` | Password |

#### JWT Token

For browser-based SSO (OIDC, GitHub, Google OAuth). Tokens expire — prefer API keys for persistent setups.

| Variable | Config Key | Description |
|----------|-----------|-------------|
| `KOMODO_JWT_TOKEN` | `komodo.jwt_token` | Pre-existing JWT token |

> **Tip:** Extract a JWT from your browser:  
> `JSON.parse(localStorage.getItem("komodo-auth-tokens-v1")).tokens[0].jwt`

### Credential Priority

When credentials are available from multiple sources, the highest-priority source wins:

```
Environment Variable  →  Docker Secret File (*_FILE)  →  Config File [komodo] section
```

### Docker Secrets

All credential variables support the Docker secrets pattern via `*_FILE` variants. The server reads the file contents at startup.

| Variable | Reads secret from file path |
|----------|---------------------------|
| `KOMODO_API_KEY_FILE` | API Key |
| `KOMODO_API_SECRET_FILE` | API Secret |
| `KOMODO_USERNAME_FILE` | Username |
| `KOMODO_PASSWORD_FILE` | Password |
| `KOMODO_JWT_TOKEN_FILE` | JWT Token |

**Example** (Docker Compose):

```yaml
services:
  komodo-mcp-server:
    image: ghcr.io/mp-tool/komodo-mcp-server:latest
    environment:
      KOMODO_URL: https://komodo.example.com:9120
      KOMODO_API_KEY_FILE: /run/secrets/komodo_api_key
      KOMODO_API_SECRET_FILE: /run/secrets/komodo_api_secret
    secrets:
      - komodo_api_key
      - komodo_api_secret

secrets:
  komodo_api_key:
    file: ./secrets/api_key.txt
  komodo_api_secret:
    file: ./secrets/api_secret.txt
```

> **Note:** Docker secret `*_FILE` variables are only supported as environment variables, not in config files.

## Transport & Network

Controls how the MCP server communicates with clients.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_TRANSPORT` | `transport.mode` | `stdio` | Transport mode: `stdio`, `http`, or `https` |
| `MCP_PORT` | `transport.port` | `8000` | HTTP/HTTPS listen port |
| `MCP_BIND_HOST` | `transport.host` | `127.0.0.1` | Bind address (`0.0.0.0` for all interfaces) |
| `MCP_LEGACY_SSE_ENABLED` | `transport.sse_enabled` | `false` | Enable legacy SSE transport (protocol 2024-11-05) |
| `MCP_JSON_RESPONSE` | `transport.json_response` | `false` | Prefer JSON over SSE for non-streaming responses |

### Transport Modes

| Mode | Use Case | Clients |
|------|----------|---------|
| **`stdio`** | Local CLI, single client | Claude Desktop, VS Code, npx |
| **`http`** | Network deployment, multi-client | Any MCP client over HTTP |
| **`https`** | Production with TLS termination | Any MCP client over HTTPS |

### TLS (HTTPS Mode)

Required when `MCP_TRANSPORT=https`:

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_TLS_CERT_PATH` | `transport.tls.cert_path` | — | TLS certificate file (PEM) |
| `MCP_TLS_KEY_PATH` | `transport.tls.key_path` | — | TLS private key file (PEM) |
| `MCP_TLS_CA_PATH` | `transport.tls.ca_path` | — | CA certificate (optional, for custom CA/mTLS) |

## Security

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_RATE_LIMIT_MAX` | `security.rate_limit_max` | `1000` | Max requests per rate limit window |
| `MCP_RATE_LIMIT_WINDOW_MS` | `security.rate_limit_window` | `15m` | Rate limit window (`"15m"`, `"1h"`, or ms) |
| `MCP_TRUST_PROXY` | `security.trust_proxy` | — | Trust proxy setting (for reverse proxies) |
| `MCP_BODY_SIZE_LIMIT` | `security.body_size_limit` | `1mb` | Max request body size |
| `MCP_ALLOWED_HOSTS` | `security.allowed_hosts` | — | DNS rebinding protection (comma-separated) |
| `MCP_CORS_ORIGIN` | `security.cors_origin` | — | CORS allowed origins (comma-separated, `*` for all) |
| `MCP_CORS_CREDENTIALS` | `security.cors_credentials` | `false` | Allow CORS credentials |
| `MCP_HELMET_HSTS` | `security.helmet_hsts` | `false` | Enable HSTS header |
| `MCP_HELMET_CSP` | `security.helmet_csp` | — | Content Security Policy |
| `MCP_HELMET_FRAME_OPTIONS` | `security.helmet_frame_options` | `DENY` | X-Frame-Options header |

## Sessions

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_MAX_SESSIONS` | `session.max_sessions` | `200` | Max total concurrent sessions |
| `MCP_MAX_STREAMABLE_HTTP_SESSIONS` | `session.max_streamable_http_sessions` | `100` | Max Streamable HTTP sessions |
| `MCP_MAX_SSE_SESSIONS` | `session.max_sse_sessions` | `50` | Max legacy SSE sessions |

## Logging

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `LOG_LEVEL` | `logging.level` | `info` | Log level: `error`, `warn`, `info`, `debug`, `trace` |
| `LOG_FORMAT` | `logging.format` | `text` | Output format: `text` or `json` (ECS-compatible) |
| `LOG_TIMESTAMP` | `logging.timestamp` | `false` | Include timestamps in text output |
| `LOG_COMPONENT` | `logging.component` | `false` | Include component name in text output |
| `LOG_DIR` | `logging.dir` | — | Directory for file logging (disabled if unset) |
| `LOG_MAX_FILE_SIZE` | `logging.max_file_size` | `10mb` | Max log file size before rotation |
| `LOG_MAX_FILES` | `logging.max_files` | `3` | Max rotated log files to keep |
| `LOG_RETENTION_DAYS` | `logging.retention_days` | `0` | Delete log files older than N days (0 = disabled) |

## Telemetry (Experimental)

OpenTelemetry integration for distributed tracing and metrics. Zero overhead when disabled.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `OTEL_ENABLED` | `telemetry.enabled` | `false` | Master toggle for all OTEL features |
| `OTEL_SERVICE_NAME` | `telemetry.service_name` | Server name | Service name for traces/metrics |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `telemetry.exporter_endpoint` | — | OTLP endpoint (e.g. `http://jaeger:4318`) |
| `OTEL_TRACES_EXPORTER` | `telemetry.traces_exporter` | `none` | Trace exporter: `otlp`, `console`, `none` |
| `OTEL_LOGS_EXPORTER` | `telemetry.logs_exporter` | `none` | Log exporter: `otlp`, `console`, `none` |
| `OTEL_METRICS_EXPORTER` | `telemetry.metrics_exporter` | `prometheus` | Metric exporter: `otlp`, `prometheus`, `console`, `none` |
| `OTEL_METRIC_EXPORT_INTERVAL` | `telemetry.metric_export_interval` | SDK default | Metric push interval (ms) |
| `OTEL_LOG_LEVEL` | `telemetry.log_level` | `none` | SDK diagnostic log level |

## Config File Sections

The config file is organized into sections that map to the tables above:

```toml
[komodo]              # Komodo connection & credentials
[transport]           # Transport mode, port, host
[transport.tls]       # TLS certificates (HTTPS mode)
[security]            # Rate limiting, CORS, Helmet, DNS rebinding
[session]             # Session limits
[logging]             # Log level, format, file output
[telemetry]           # OpenTelemetry configuration
```

See [`example.config.toml`](./example.config.toml) for a complete reference with all fields documented.

## More Info

- [Main Documentation](../README.md)
- [Docker Deployment](../docker/README.md)
- [Client Integrations](../examples/README.md)
