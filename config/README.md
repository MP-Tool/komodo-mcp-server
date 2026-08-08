# Configuration Reference

Central reference for how the Komodo MCP Server behaves and how to configure it.

The server is configured through **environment variables**, a **config file** (TOML, YAML, JSON), or both (env wins). This page covers the server's behavior, the priority chain, and the most important settings. For the **complete per-setting reference**, see [`example.config.toml`](./example.config.toml) (and the `.yaml` / `.env` variants). For client- and deployment-specific setup, see [`examples/`](../examples/README.md) and [`docker/`](../docker/README.md).

## How the Server Behaves

Since 1.5.0 the server is **secure by default**:

- **Authentication is on by default** for `http`/`https`. Clients sign in (browser username/password against Komodo), and each user acts as their **own** Komodo identity with their own permissions - never a shared account. Turn it off with `MCP_AUTH_ENABLED=false`.
- **An open network server is read-only.** If you disable auth on `http`/`https`, anonymous callers get **read-only** access - every write/exec/delete tool (including `komodo_exec`) is hidden and rejected. The only way to write over the network is to enable auth. **stdio** is local and always fully capable.
- **Fail-closed on misconfiguration.** If auth is on but no Komodo URL/credentials are configured, the server rejects every request instead of running open.
- **Per-resource permission checks.** Authenticated calls verify the user's Komodo permission on the target resource *before* running.
- **Destructive actions ask first.** Deletes, `destroy`, prune, `komodo_exec`, and procedure/action/sync runs require explicit confirmation in the client (MCP elicitation), fail-closed.
- **Secrets are redacted** from tool output at a central, fail-closed boundary before they reach the client transcript or the model.
- **The tool surface can be limited** - restrict which tools clients may use (e.g. read-only, no terminal access) and keep the tool list small.

**Naming convention:** `KOMODO_*` configures the *connection to Komodo Core*; `MCP_*` (and `LOG_*` / `OTEL_*`) configures *this MCP server's own behavior*.

## Configuration Priority

The server follows the [12-Factor App](https://12factor.net/config) methodology. Configuration sources are merged top-down - **higher sources override lower ones**:

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

The server supports three config file formats. All are functionally equivalent - choose whichever you prefer.

| Format | Filename | Notes |
|--------|----------|-------|
| **TOML** | `config.toml` | Recommended - comments, readable, explicit types |
| **YAML** | `config.yaml` / `config.yml` | Familiar to Docker/Kubernetes users |
| **JSON** | `config.json` | No comments - least recommended |

### Auto-Discovery

When no explicit path is specified, the server searches the working directory for config files in this order:

```
config.toml -> config.yaml -> config.yml -> config.json
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

## Komodo Connection

These settings configure how the MCP server talks to Komodo Core. It's a single shared connection,
used for **stdio** (local, one user) and for **open HTTP mode** (authentication disabled). With
authentication enabled (the default for http/https), each user signs in with their **own** Komodo
account instead, and this shared connection isn't used for them - see
[MCP-Server Authentication](#mcp-server-authentication) below.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `KOMODO_URL` | `komodo.url` | - | Komodo Core server URL (required) |
| `KOMODO_API_TIMEOUT_MS` | `komodo.api_timeout_ms` | `30s` | Komodo API request timeout (duration or ms) |

### Connection Credentials

Choose **one** of three credential methods for the connection:

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

For browser-based SSO (OIDC, GitHub, Google OAuth). Tokens expire - prefer API keys for persistent setups.

| Variable | Config Key | Description |
|----------|-----------|-------------|
| `KOMODO_JWT_TOKEN` | `komodo.jwt_token` | Pre-existing JWT token |

> **Tip:** Extract a JWT from your browser:  
> `JSON.parse(localStorage.getItem("komodo-auth-tokens-v1")).tokens[0].jwt`

### Credential Priority

When credentials are available from multiple sources, the highest-priority source wins:

```
Environment Variable  ->  Docker Secret File (*_FILE)  ->  Config File [komodo] section
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

## MCP-Server Authentication

Controls whether **clients** must authenticate to the MCP server - distinct from the Komodo
connection above. Only applies to `http`/`https`; `stdio` is local and never authenticated.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_AUTH_ENABLED` | `auth.enabled` | `true` | Require clients to sign in |
| `MCP_AUTH_REQUIRED_SCOPES` | `auth.required_scopes` | - | Required scopes for `/mcp` (advanced) |

> The RFC 9728 Protected Resource Metadata URL is derived automatically from the public base URL
> (`MCP_BASE_URL`) — there is no separate setting.

**Enabled (default):** clients sign in via a browser username/password login against Komodo; each
user gets an isolated, per-user Komodo session with their own permissions, and every tool call is
permission-checked on Komodo before it runs.

**Disabled (`MCP_AUTH_ENABLED=false`) on a network transport:** the server runs **read-only** for
anonymous callers - write/exec/delete tools (including `komodo_exec`) are hidden from `tools/list`
and rejected on call. Enable auth to allow write access. `stdio` is unaffected (fully capable).

> External OAuth providers (`[auth.providers.*]` - Google/GitHub/OIDC) are reserved for upcoming
> work and not wired in yet; enabling auth today offers local Komodo login.

## Transport & Network

Controls how the MCP server communicates with clients.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_TRANSPORT` | `transport.mode` | `stdio` | Transport mode: `stdio`, `http`, or `https` |
| `MCP_PORT` | `transport.port` | `8000` | HTTP/HTTPS listen port |
| `MCP_BIND_HOST` | `transport.host` | `127.0.0.1` | Bind address (`0.0.0.0` for all interfaces) |
| `MCP_BASE_URL` | `transport.base_url` | *(derived)* | Public URL behind a proxy/domain (OAuth redirects, metadata URL, trusted host) |
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
| `MCP_TLS_CERT_PATH` | `transport.tls.cert_path` | - | TLS certificate file (PEM) |
| `MCP_TLS_KEY_PATH` | `transport.tls.key_path` | - | TLS private key file (PEM) |
| `MCP_TLS_CA_PATH` | `transport.tls.ca_path` | - | CA certificate (optional, for custom CA/mTLS) |

## Security

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_RATE_LIMIT_MAX` | `security.rate_limit_max` | `1000` | Max requests per rate limit window |
| `MCP_RATE_LIMIT_WINDOW_MS` | `security.rate_limit_window` | `15m` | Rate limit window (`"15m"`, `"1h"`, or ms) |
| `MCP_TRUST_PROXY` | `security.trust_proxy` | - | Trust proxy setting (for reverse proxies) |
| `MCP_BODY_SIZE_LIMIT` | `security.body_size_limit` | `1mb` | Max request body size |
| `MCP_ALLOWED_HOSTS` | `security.allowed_hosts` | - | DNS rebinding protection (comma-separated) |
| `MCP_CORS_ORIGIN` | `security.cors_origin` | - | CORS allowed origins (comma-separated, `*` for all) |
| `MCP_CORS_CREDENTIALS` | `security.cors_credentials` | `false` | Allow CORS credentials |
| `MCP_HELMET_HSTS` | `security.helmet_hsts` | `false` | Enable HSTS header |
| `MCP_HELMET_CSP` | `security.helmet_csp` | - | Content Security Policy |
| `MCP_HELMET_FRAME_OPTIONS` | `security.helmet_frame_options` | `DENY` | X-Frame-Options header |

### Destructive-Action Confirmation

Destructive tools (deletes, destroy, prune, exec, procedure/action/sync runs) ask the human
operator for approval via the MCP client's elicitation UI before executing.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_CONFIRM_DESTRUCTIVE` | `tools.confirm_destructive` | `true` | Require manual confirmation for destructive tools |
| `MCP_CONFIRM_FALLBACK` | `tools.confirm_fallback` | `deny` | When the client cannot prompt (no elicitation support / stateless mode): `deny` refuses the call, `allow` executes with a warning |
| `MCP_CONFIRM_TIMEOUT_MS` | `tools.confirm_timeout` | `5m` | How long to wait for the confirmation answer (duration like `30s`/`5m`/`1h`, or ms) |

### Secret Redaction

The framework scrubs likely secrets out of **every** tool result at a central, fail-closed
boundary before it reaches the client transcript; offloaded resource links are scrubbed when they
are registered. This is a **best-effort, defence-in-depth** measure - key-name and value-shape
heuristics, not a guarantee.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_SECRET_SCRUB_ENABLED` | `redaction.enabled` | `true` | Master switch for secret scrubbing of tool output |
| `MCP_SECRET_SCRUB_KEYS` | `redaction.keys` | - | Comma-separated extra key-name fragments to always redact (case-insensitive) |
| `MCP_SECRET_SCRUB_ALLOW_KEYS` | `redaction.allow_keys` | - | Comma-separated exact key names to never redact by key-matching (case-insensitive), merged with the built-in allowlist (`public_key`, `is_secret`, ...) |

The underlying server framework brings its own generic equivalents. They work here too, as the
**base layer** that the `MCP_SECRET_SCRUB_*` settings above extend:

| Variable | Relationship to the Komodo setting |
|----------|-----------------------------------|
| `MCP_SCRUB_ENABLED` | Base switch. `MCP_SECRET_SCRUB_ENABLED` overrides it when set; with neither set, redaction is **on**. |
| `MCP_SCRUB_ADDITIONAL_KEYS` | Combined with `MCP_SECRET_SCRUB_KEYS` - a key listed in either is redacted. |
| `MCP_SCRUB_ALLOW_KEYS` | Combined with `MCP_SECRET_SCRUB_ALLOW_KEYS` and the built-in allowlist. |

You only need one set. Use the `MCP_SECRET_SCRUB_*` names unless you are configuring several
framework-based servers from one shared environment.

**Coverage:** every tool result - structured resource config (env var blocks, `webhook_secret`,
`passkey`), alerter webhook URLs/emails, container inspect `Config.Env`, `komodo_exec` output,
container/build/update logs, and the sync-TOML export - inline payloads AND offloaded resource
links. Fail-closed: if scrubbing itself fails, the result is withheld rather than returned
unscrubbed. Komodo's domain rules are declared as policy and enforced by the same engine: secret
variables (`is_secret`) always have their value masked, alerter endpoint URLs/emails are masked by
path, and stacks' post-interpolation `deployed_config`/`deployed_contents` are removed entirely -
in structured payloads, rendered text, offloaded JSON and exported TOML alike.

> **The TOML export is redacted, so it is not directly re-appliable.** `komodo_toml_export_*`
> masks secret values, which means the exported file is meant for reading and diffing rather than
> for feeding straight back through ResourceSync. The `secrets_masked` field in the result reports
> whether redaction actually ran. Note that Komodo Core itself only masks variable values, and only
> for non-admin callers - server passkeys and alerter webhook URLs are never masked upstream, so
> switching redaction off means those leave the server in plaintext.

**Intended exception:** `komodo_user_create_api_key` returns its one-time secret unredacted -
that is the tool's purpose. The secret persists in the client transcript; rotate the key if the
transcript is untrusted.

**Limits:** runtime output (exec/logs) is scanned with the same heuristics - deterministic shapes
(tokenised URLs, JWTs, `KEY=value` pairs) are caught, but arbitrary secret material without a
recognizable shape is not. Don't rely on this feature as the only line of defence.

### Tool Surface

Limit which tools clients can use - to restrict what the assistant is allowed to do (e.g. read-only,
no terminal access) and to keep the tool list small (fewer tokens). Category values are the
`_meta.category` strings: `config`, `container`, `server`, `stack`, `deployment`, `build`, `repo`,
`procedure`, `action`, `alerter`, `swarm`, `resource_sync`, `variable`, `update`, `terminal`, `user`.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_TOOLS_ALLOWED_CATEGORIES` | `tools.allowed_categories` | *(all)* | Allow only these categories. Unset = all allowed |
| `MCP_TOOLS_EXCLUDED_CATEGORIES` | `tools.excluded_categories` | - | Remove whole categories |
| `MCP_TOOLS_EXCLUDED_TOOLS` | `tools.excluded_tools` | - | Remove individual tools by name (e.g. `komodo_exec`) |

These only **remove** tools (allowlist first, then the excludes) - removed tools are absent from
`tools/list` and not callable. They never add tools or bypass authentication. An unknown category is
ignored with a startup warning; a misspelled tool name simply has no effect.

## Resources

Large tool outputs (logs, inspect data) are offloaded to session-scoped `ephemeral://...` resource
links, fetched out-of-band via `resources/read`, so they don't bloat the tool result inline.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_RESOURCE_TTL_INFO` | `resources.ttl_info` | `15m` | TTL for info/inspect resources (duration or ms) |
| `MCP_RESOURCE_TTL_LOGS` | `resources.ttl_logs` | `2m` | TTL for log resources (duration or ms) |
| `MCP_RESOURCE_MAX_ENTRIES` | `resources.max_entries` | `1000` | Max ephemeral entries kept in memory (oldest evicted first) |

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
| `LOG_DIR` | `logging.dir` | - | Directory for file logging (disabled if unset) |
| `LOG_MAX_FILE_SIZE` | `logging.max_file_size` | `10mb` | Max log file size before rotation |
| `LOG_MAX_FILES` | `logging.max_files` | `3` | Max rotated log files to keep |
| `LOG_RETENTION_DAYS` | `logging.retention_days` | `0` | Delete log files older than N days (0 = disabled) |
| `LOG_AUDIT_FILE` | `logging.audit_file` | `<logs>/audit.log` | Path to the JSON-Lines audit-log file (always on) |
| `LOG_AUDIT_TOOL_IO` | `logging.audit_tool_io` | `summary` | Audit request/result depth per tool call (scrubbed): `off`, `summary`, `full` |

## Telemetry (Experimental)

OpenTelemetry integration for distributed tracing and metrics. Zero overhead when disabled.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `OTEL_ENABLED` | `telemetry.enabled` | `false` | Master toggle for all OTEL features |
| `OTEL_SERVICE_NAME` | `telemetry.service_name` | Server name | Service name for traces/metrics |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `telemetry.exporter_endpoint` | - | OTLP endpoint (e.g. `http://jaeger:4318`) |
| `OTEL_TRACES_EXPORTER` | `telemetry.traces_exporter` | `none` | Trace exporter: `otlp`, `console`, `none` |
| `OTEL_LOGS_EXPORTER` | `telemetry.logs_exporter` | `none` | Log exporter: `otlp`, `console`, `none` |
| `OTEL_METRICS_EXPORTER` | `telemetry.metrics_exporter` | `prometheus` | Metric exporter: `otlp`, `prometheus`, `console`, `none` |
| `OTEL_METRIC_EXPORT_INTERVAL` | `telemetry.metric_export_interval` | SDK default | Metric push interval (ms) |
| `OTEL_LOG_LEVEL` | `telemetry.log_level` | `none` | SDK diagnostic log level |

## Config File Sections

The config file is organized into sections that map to the tables above:

```toml
[komodo]              # Komodo Core connection & credentials (KOMODO_*)
[auth]                # MCP-server authentication (MCP_AUTH_*)
[transport]           # Transport mode, port, host
[transport.tls]       # TLS certificates (HTTPS mode)
[security]            # Rate limiting, CORS, Helmet, DNS rebinding
[tools]               # Tool surface + destructive-action confirmation (MCP_TOOLS_* / MCP_CONFIRM_*)
[redaction]           # Secret redaction of tool output (MCP_SECRET_SCRUB_*)
[resources]           # Ephemeral resource registry (MCP_RESOURCE_*)
[session]             # Session limits
[logging]             # Log level, format, file output
[telemetry]           # OpenTelemetry configuration
```

See [`example.config.toml`](./example.config.toml) for a complete reference with all fields documented.

## More Info

- [Main Documentation](../README.md)
- [Docker Deployment](../docker/README.md)
- [Client Integrations](../examples/README.md)
