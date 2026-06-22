# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

--------------------------------------------------------------

## [Unreleased]

## [1.4.1] - Fixes tools and update dependencies

### Fixed

- **`komodo_exec` — `target: "server"` failed with HTTP 500 on Komodo Core v2** ([#135](https://github.com/MP-Tool/komodo-mcp-server/issues/135)): Running a command on a server target always returned an error. The terminal session was not being initialised before the command was sent, which Komodo v2 requires. The `shell` parameter (default `sh`) now also applies to `target: "server"`, consistent with the other targets.
- **`komodo_exec` — exit code was always missing or showed `%d` instead of a number** ([#135](https://github.com/MP-Tool/komodo-mcp-server/issues/135)): The exit code reported by Komodo was not being recognised correctly, so `exit_code` was always `null` for server targets and sometimes showed the raw placeholder `%d` for container/deployment/stack targets. Both cases are now handled and invalid values are returned as `null`.
- **`komodo_exec` — `target: "server"` returned garbled output instead of the command result** ([#135](https://github.com/MP-Tool/komodo-mcp-server/issues/135)): Instead of showing the actual command output, the response contained internal protocol markers from Komodo. Caused by a known issue in Komodo Periphery where the terminal echoes the command scaffold back into the output stream before the real output arrives. Fixed client-side; a separate bug report has been filed with the Komodo project.
- **`komodo_user_delete_api_key` — deleting by key name returned HTTP 404**: The tool expected the raw `K_...` key string, but a name like `"test"` was a natural and expected input. When the name was passed, Komodo returned 404 because it could not find a key matching that identifier. The tool now accepts either the key name or the full `K_...` string. If a name is provided, it is resolved to the key string via `ListApiKeys` before deletion. If multiple keys share the same name, the tool asks for the full key string to avoid ambiguity.

### Dependencies
- Bumped: mcp-server-framework from 1.1.0 to 1.1.2, qs from 6.15.1 to 6.15.2, typescript-eslint from 8.59.3 to 8.59.4, @grpc/grpc-js from 1.14.3 to 1.14.4, hono from 4.12.18 to 4.12.26 and all other dependencies to their latest versions for security and stability

---

## [1.4.0] - Full Komodo Coverage & Context Efficiency

A major release focused on **breadth, clarity and context efficiency**. The tool surface grew from 51 to **70 tools across 16 categories** and now covers every Komodo resource type — Builds, Repos, Procedures, Actions, Alerters, Docker Swarms, Variables, Resource Syncs and the Update audit log — while large payloads no longer flood your AI assistant's context window.

### Highlights

- 🧰 **Full Komodo coverage** — Manage every Komodo resource from your AI assistant: containers, servers, stacks, deployments, builds, repos, procedures, actions, alerters, Docker Swarms (Komodo v2), variables, resource syncs and the audit log.
- 🪶 **Smaller context, faster answers** — Big responses (`inspect`, `info`, `logs`, `search_logs`) are no longer dumped into the chat. They live as session-scoped resources your client fetches on demand. Pass `inline_full: true` to opt out.
- 📑 **Cursor pagination on every list** — Stop pulling thousands of containers, deployments or update entries into a single response. Default page size is 50 (1–100), and a `next_cursor` lets your assistant page through results without overwhelming the LLM.
- 📊 **Typed responses for both humans and LLMs** — Every read tool now returns rich Markdown (state badges, formatted logs, exec output) for the user *and* a typed `structuredContent` payload for the LLM. Modern clients render both; legacy clients see clean Markdown.
- 🪝 **Consistent tool names** — All tools follow `komodo_<domain>_<action>` (e.g. `komodo_container_list`, `komodo_server_info`). Easier to remember, easier to teach your AI assistant.
- 📂 **Categories & RBAC scopes** — Every tool carries a `_meta.category` (16 categories) and `requiredScopes` (`komodo:read` / `komodo:operate` / `komodo:admin`), so MCP gateways and clients can filter or gate tools cleanly.

### Added

#### New resource domains

- **Builds (6 tools)** — List, inspect, run, cancel, fetch logs and create/update/delete Komodo Builds. The `run` tool reports live progress while the build executes.
- **Repos (5 tools)** — List, inspect and create/update/delete Komodo Repos plus a single `komodo_repo_action` covering `clone` / `pull` / `build` / `cancel_build`.
- **Procedures (5 tools)** — Run and manage multi-stage Komodo Procedures, with live per-stage progress reporting while a procedure executes.
- **Actions (5 tools)** — Run, cancel and manage Komodo Actions (KomodoTS scripts). Live progress for `run`.
- **Alerters (4 tools)** — List, inspect and create/update/delete Komodo Alerter sinks (Slack, Discord, Pushover, Custom HTTP …).
- **Docker Swarm (7 tools, Komodo v2)** — Manage Swarm clusters end-to-end: list/info, list nodes, list services, create/update/delete, plus a single `komodo_swarm_action` covering node updates and removal of nodes / services / stacks.
- **Variables (4 tools)** — Manage Komodo Variables and Secrets. `apply` handles both create and update of value, description and the `is_secret` flag.
- **Resource Syncs (5 tools)** — Manage Komodo's GitOps-style ResourceSyncs: list/info, run, refresh and create/update/delete.
- **Update audit log (2 tools, read-only)** — Query the global Komodo Update log with server-side filtering by `operation`, `target_type` and `target_id`, paginated through the standard cursor envelope.

#### Smarter, leaner responses

- **Ephemeral resource links** — `komodo_container_inspect`, `komodo_container_logs`, `komodo_container_search_logs`, `komodo_server_info`, `komodo_deployment_info`, `komodo_stack_info` and most `info` tools now register their full payload as a session-scoped `ephemeral://…` resource. The text response shrinks to a one-line pointer; the assistant can fetch the full payload on demand via `resources/read`. Pass `inline_full: true` to keep the legacy inline behavior. Stateless clients automatically fall back to inlining — nothing breaks.
- **Cursor-based pagination** on every list tool (`{ cursor?, page_size? }`, 1–100, default 50) with a `page: { next_cursor?, total }` envelope. The Markdown renderer appends a clear footer when more results exist.
- **Typed `structuredContent` on every read and state-change tool** — Per the MCP 2025-06-18 "Structured Content" recommendation, modern clients receive a validated typed payload alongside the human-readable Markdown. This includes 11 read tools, every `*_action`, every `*_apply`, every `*_delete`, plus `komodo_exec`, `komodo_health_check`, `komodo_configure`, `komodo_user_list_api_keys`, `komodo_user_create_api_key` and `komodo_user_delete_api_key`.
- **Rich Markdown formatting** — Bullet lists with state badges (`✅ Running`, `🟡 Paused`, `❌ Exited`), embedded JSON for inspect/info, fenced code blocks for logs and exec output, and multi-line action results showing `Status`, `Update ID`, `Version` plus the most relevant log excerpts (last two stages on success, all failed/stderr stages on failure).

#### Operability

- **`_meta.category` on every tool** — One of 16 categories. MCP clients and gateways can filter or group tools by category.
- **`requiredScopes` on every tool** — Three-tier RBAC (`komodo:read` / `komodo:operate` / `komodo:admin`). Currently passive (Komodo has no OIDC yet); the framework's scope filter will activate automatically once tokens carry scopes.
- **New environment variables** for the resource-link cache: `KOMODO_RESOURCE_TTL_INFO` (default `15m`), `KOMODO_RESOURCE_TTL_LOGS` (default `2m`) and `KOMODO_RESOURCE_MAX_ENTRIES` (default `1000`). Logs use a shorter TTL because of their volatility.

### Changed (Breaking)

- **Tool naming** — All tools were renamed to `komodo_<domain>_<action>`. Examples: `komodo_list_containers` → `komodo_container_list`, `komodo_get_server_info` → `komodo_server_info`, `komodo_create_api_key` → `komodo_user_create_api_key`. See **Migration** below.
- **Lifecycle consolidation** — Per-verb container/stack/deployment/repo lifecycle tools were collapsed into a single `*_action` tool per domain with an `action` discriminator. `komodo_container_action` covers `start` / `stop` / `restart` / `pause` / `unpause`; `komodo_stack_action` and `komodo_deployment_action` cover `deploy` / `pull` / `start` / `restart` / `pause` / `unpause` / `stop` / `destroy`; `komodo_repo_action` covers `clone` / `pull` / `build` / `cancel_build`.
- **CRUD consolidation (`*_apply`)** — `komodo_<domain>_create` and `komodo_<domain>_update` were merged into `komodo_<domain>_apply` with `{ action: "create" | "update" }` for `server`, `stack`, `deployment`, `build`, `repo`, `procedure`, `swarm` and the new domains (Action, Alerter, ResourceSync, Variable). 14 tools became 7.
- **Build run/cancel consolidation** — `komodo_build_run` and `komodo_build_cancel` merged into `komodo_build_action`.
- **Procedure run consolidation** — `komodo_procedure_run` renamed to `komodo_procedure_action` for naming consistency.
- **Terminal consolidation** — `komodo_server_exec`, `komodo_container_exec`, `komodo_deployment_exec` and `komodo_stack_service_exec` merged into a single `komodo_exec` tool with a `target` discriminator (`server` / `container` / `deployment` / `stack_service`).
- **Prune relocation** — The standalone `komodo_prune` tool is gone. Pruning is now part of `komodo_server_action`, alongside the new batch container ops (`start_all_containers`, `restart_all_containers`, `pause_all_containers`, `unpause_all_containers`, `stop_all_containers`), the full prune family (`prune_containers` / `prune_images` / `prune_volumes` / `prune_networks` / `prune_system` / `prune_docker_builders` / `prune_buildx`) and named-resource deletion (`delete_network` / `delete_image` / `delete_volume`). All require `komodo:admin`.

### Fixed

- **`komodo_exec` no longer leaves an orphan rejected promise on auth failure ([#124](https://github.com/MP-Tool/komodo-mcp-server/pull/124))** — When an API key lacked the `Terminal` permission, the exec helper produced a second, unhandled rejection alongside the real error. Cleanup now runs through a single `.finally()` chain so the side-channel rejection no longer exists. Thanks to @puigru for the report and original patch.
- **`KomodoClient.login()` timer leak ([#125](https://github.com/MP-Tool/komodo-mcp-server/issues/125))** — The login timeout's `setTimeout` was never cleared after the race resolved, keeping the process alive for up to `API_TIMEOUT_MS` longer than necessary and risking an unhandled rejection on a late timer fire. The timer is now cleared in `finally` on both the success and error paths.

### Removed

- **Builder tools (4 tools)** — `komodo_builder_list`, `komodo_builder_info`, `komodo_builder_apply` and `komodo_builder_delete` were removed. In Komodo v2, Builders are conceptually Komodo Servers/Nodes — the dedicated tools added duplicate surface without operational value. Use `komodo_server_*` instead.

### Dependencies

- Bumped `mcp-server-framework` from `^1.0.5` to `^1.1.0` for the new `structured()` response helper, typed `output` schemas on `defineTool()`, the dynamic resource registry powering `ephemeral://…` links, and per-call resource read context.

### Migration

The renames and consolidations are breaking. Update any client prompts, scripts or AI assistant instructions that hard-code old tool names.

- **Renames** — Replace `komodo_list_*` / `komodo_get_*` / `komodo_*_container` calls with the new `komodo_<domain>_<action>` names. Examples: `komodo_list_containers` → `komodo_container_list`, `komodo_get_server_info` → `komodo_server_info`, `komodo_create_api_key` → `komodo_user_create_api_key`.
- **Lifecycle (`*_action`)** — Replace per-verb container/stack/deployment/repo tools with the consolidated `*_action` tool. Example: `komodo_repo_clone` → `komodo_repo_action` with `{ action: "clone", repo: "<id-or-name>" }`.
- **CRUD (`*_apply`)** — Replace `*_create` / `*_update` with `*_apply`:
  - Create: `{ action: "create", name: "<name>", config: { … } }`
  - Update: `{ action: "update", <domain>: "<id-or-name>", config: { … } }` (e.g. `server: "prod-1"`, `stack: "my-stack"`)
- **Builds** — `komodo_build_run` and `komodo_build_cancel` → `komodo_build_action` with `{ action: "run" | "cancel", build: "<id-or-name>" }`.
- **Terminal** — `komodo_server_exec` / `komodo_container_exec` / `komodo_deployment_exec` / `komodo_stack_service_exec` → `komodo_exec` with `{ target: "server" | "container" | "deployment" | "stack_service", … }`.
- **Prune** — `komodo_prune` → `komodo_server_action` with `{ action: "prune_containers" | "prune_images" | … }`.
- **Builders** — Tools removed. Use `komodo_server_list` / `komodo_server_info` / `komodo_server_apply` for the underlying Komodo Server resource.

--------------------------------------------------------------

## [1.3.2] - Quality & Maintenance

### Dependencies

- Updated `komodo_client` to 2.1.1 with latest API improvements
- Updated all other dependencies to their latest versions for security and stability

--------------------------------------------------------------

## [1.3.1] - Improved Progress Reporting & Connection Stability

### Improved

- **Real-time operation stages**: Deploy, start, stop and other long-running operations now show exactly what Komodo is doing (e.g. "Pulling Image", "Starting Container") instead of a generic timer — you always know what's happening
- **Better progress bars in terminal tools**: Remote command execution now shows proper progress indicators compatible with all MCP clients
- **Live log streaming to AI client**: During tool execution, server logs are automatically forwarded to the AI assistant — the AI sees what's going on behind the scenes for better troubleshooting
- **SSE streaming enabled by default**: Progress updates, log messages, and operation status are now reliably delivered during tool execution (previously could be silently dropped in JSON response mode)
- **Stable connections behind proxies**: Long-running connections are kept alive with periodic heartbeats — no more random disconnects when using reverse proxies, load balancers, or cloud deployments

### Fixed

- **Docker startup with missing config file**: The server no longer crashes if `MCP_CONFIG_FILE_PATH` points to a file that doesn't exist yet (e.g. Docker volume not mounted). It now starts gracefully with a warning and uses environment variables only
- **Noisy AI client notifications**: Removed unnecessary debug-level notifications that were being forwarded to the AI client, reducing clutter in the conversation

### Security

- Hardened CI/CD pipeline against supply-chain attacks (pinned dependencies, reproducible builds)
- Added automated code scanning for common security patterns (OWASP)
- Improved rate limiting, clickjacking protection, and regex safety in the underlying framework

### Dependencies

- Updated `mcp-server-framework` to v1.0.5

--------------------------------------------------------------

## [1.3.0]

### Added

- **Live progress reporting**: Long-running operations (deploy, start, stop, restart, etc.) now report progress updates to the AI client in real time — no more silent waiting
- **Cancellation support**: All lifecycle operations can be cancelled mid-flight — the AI client can abort running deployments, stack operations, or container actions at any time
- **Richer operation results**: Completed operations now include success/failure status, version info, and relevant log output directly in the response — faster diagnosis without separate log queries
- **Stack file dependencies**: Full support for Komodo v2 stack file dependencies with service mappings and cross-stack requires
- **Environment file tracking**: Stack environment files now support the `track` flag for change detection
- **Compose wrapper includes**: New `compose_cmd_wrapper_include` field for selective compose command wrapping

- **Remote command execution**: Run shell commands directly on servers, inside containers, deployments, and stack services — diagnose issues, run maintenance tasks, or check application state without leaving the AI conversation
- **Live output with progress**: Terminal output streams back in real time with progress updates — long-running commands show what's happening instead of going silent
- **API key management**: List, create, and delete API keys for the currently authenticated user — manage access credentials directly through the AI assistant

- **Three authentication methods**: Support for API Key, JWT Token, and Username/Password authentication — choose the method that fits your setup
- **JWT Token support**: Use pre-existing JWT tokens from browser-based logins (OIDC, GitHub, Google OAuth) to authenticate without storing credentials
- **Automatic connection on startup**: When credentials are configured via environment variables or config file, the server connects to Komodo automatically at launch — no manual `komodo_configure` call needed
- **Connection monitoring with auto-reconnect**: Periodic health checks detect connection loss and automatically re-establish the connection with exponential backoff
- **Login method discovery**: The `komodo_configure` tool queries available login methods (local, GitHub, Google, OIDC) from the Komodo server and displays them for informational purposes
- **Auth rejection detection**: Authentication failures (invalid credentials, expired tokens, unknown users) are clearly distinguished from network errors and reported with actionable messages
- **Error extraction utilities**: Komodo API errors are parsed and formatted into human-readable messages with proper error classification

- **Complete configuration reference**: New `config/` directory with a central reference guide and ready-to-use example configs (TOML, YAML, .env) — every setting documented in one place so you can get started without guessing environment variable names
- **Copy-and-customize config templates**: Just copy `example.config.toml` (or YAML/.env) into your project, adjust the values, and you're done — no more searching through docs for the right variable names
- **Streamlined Docker deployment**: New `docker/` directory with a step-by-step guide, ready-to-use `compose.yaml`, and preconfigured `.env` template — get a production-ready container running in minutes with just `docker compose up -d`
- **Node.js / npx setup guide**: New `examples/node/` guide for running the server natively without Docker — covers npx, global install, and platform-specific instructions for Linux, macOS, and Windows
- **Improved client integration guides**: Overhauled setup guides for Claude Desktop and VS Code / GitHub Copilot with clearer steps and updated example configs
- **Refreshed README**: Cleaner feature overview, streamlined quick start, and better navigation to all documentation and integration guides

- **Modernized DevContainer**: Faster container startup with lighter `postCreateCommand`, correct port forwarding (8000), Prettier and TypeScript SDK preconfigured — just open in VS Code and start coding
- **Improved MCP Registry metadata**: Richer server.json with repository verification, Docker runtime hints, and input placeholders — MCP clients can display better setup guidance and verify package integrity

### Changed

- **komodo_client v2.0.0 Auth API**: Migrated authentication calls to namespaced API (`auth.login()`, `auth.manage()`) — supports `JwtOrTwoFactor` discriminated union response with explicit 2FA rejection
- **Login options**: `getLoginOptions()` now includes `registration_disabled` field from Komodo v2
- **Connection architecture**: Unified connection management — a single `KomodoConnection` class handles client lifecycle, authentication, health monitoring, and reconnect logic
- **Configure tool**: Richer feedback on connection status including Komodo version, health check results, and available login methods
- **Health check tool**: Reports detailed connection state including server version, MCP server version, and clear status indicators
- **Credential configuration**: Support for Docker secrets (`*_FILE` env vars), config file (`[komodo]` section), and direct environment variables with clear priority chain
- **Environment variable naming**: `KOMODO_JWT_TOKEN` (was `KOMODO_JWT_SECRET`) — clearly identifies the value as a token, not a signing key
- **Validation error handling**: Invalid tool inputs (e.g. multiple auth methods) return clean MCP error responses with server-side warning logs instead of unhandled exceptions

### Fixed

- **localStorage crash on startup**: Added temporary polyfill for `localStorage` in Node.js — `mogh_auth_client` (transitive dependency of `komodo_client` v2) calls `localStorage.getItem()` at module load, which crashes in Node.js 22+ where `localStorage` exists but has no methods without `--localstorage-file`

### Removed

- Framework's `ConnectionStateManager` dependency — connection management is now fully self-contained

### Dependencies

- Updated `komodo_client` to v2.0.0
- Updated `mcp-server-framework` to v1.0.3

--------------------------------------------------------------

## [1.2.2] - Docker Security & Build Optimization

### 🔐 Security

- **Hardened Runtime User**: Use built-in `node` user (UID 1000) with `/sbin/nologin` shell
  - No interactive login possible for the service account
  - Replaces custom `komodo` user for better security alignment with base image
- **Immutable Build Artifacts**: Build files owned by `root:root`, runtime user cannot modify them
  - `node_modules/` and `build/` are read-only for the application
- **Tini Init System**: Added [tini](https://github.com/krallin/tini) as PID 1 for proper signal handling
  - Ensures graceful shutdown on SIGTERM
  - Prevents zombie processes
- **Signed Git Tags**: Release tags are now cryptographically signed via GitHub API
  - Annotated tags with release notes for better traceability

### ✨ New Features

- **ARM/v6 Support**: Added 32-bit ARMv6 architecture (Raspberry Pi Zero/1)
  - Docker images now available for: `linux/amd64`, `linux/arm64`, `linux/arm/v7`, `linux/arm/v6`

### 📦 Improvements

- **Healthcheck: curl → wget**: Replaced `curl` with `wget --spider` for healthchecks
  - `wget` is included in Alpine (BusyBox) - no additional package installation needed
  - `--spider` performs HEAD request only (more efficient)
- **Optimized Docker Build**: Reduced unnecessary steps and improved layer caching
  - Copy only `src/` and `tsconfig*.json` instead of entire context
  - Removed `curl` dependency from production stage
  - Combined multiple `LABEL` statements into one
- **Build Metadata**: Embedded VERSION, BUILD_DATE, and COMMIT_SHA into container
  - Files available at `/app/build/VERSION`, `/app/build/BUILD_DATE`, `/app/build/COMMIT_SHA`
  - OCI labels include version, created date, and revision
- **GHCR Metadata Fix**: Added `DOCKER_METADATA_ANNOTATIONS_LEVELS: manifest,index` to CI
  - Fixes missing description in GitHub Container Registry for multi-arch images
- **Release Workflow Cleanup**: Removed separate attestation images from GHCR
  - Provenance and SBOM are now embedded directly in image manifest
  - Cleaner registry without `sha-*` tagged attestation artifacts

### 🐛 Bug Fixes

- **CI Annotations**: Multi-arch images now correctly display metadata in GHCR package page
- **OpenSSF Signed-Releases**: Export SLSA attestations as GitHub Release assets
  - Enables OpenSSF Scorecard to verify signed releases
  - Attestations available as `attestations.intoto.jsonl` in each release

### ⬆️ Dependencies

- `@modelcontextprotocol/sdk`: 1.25.2 → 1.26.0
- `@opentelemetry/auto-instrumentations-node`: 0.68.0 → 0.69.0
- `@opentelemetry/exporter-trace-otlp-http`: 0.210.0 → 0.211.0
- `@opentelemetry/sdk-node`: 0.210.0 → 0.211.0
- `hono`: 4.11.4 → 4.11.7

--------------------------------------------------------------
## [1.2.1] - Minojr Bug Fixes

### 🐛 Bug Fixes

- **Docker ARM64 Build**: Fixed QEMU emulation failure during ARM64 cross-compilation
  - Moved `npm prune --omit=dev` to builder stage to avoid running npm in production stage under QEMU
  - Production stage now copies pre-pruned `node_modules` from builder instead of running `npm ci`
  - Resolves "Illegal instruction (core dumped)" error on ARM64 builds

- **Version Resolution in Docker**: Fixed server failing to start with "Server version is required" error
  - Version is now baked into `build/VERSION` during Docker build from `package.json`
  - Single Source of Truth: `package.json` → immutable once image is built
  - Fallback chain: `build/VERSION` → `npm_package_version` → `package.json`

### ✨ New Features

- **ARM/v7 Support**: Added 32-bit ARM architecture support (Raspberry Pi 3, older ARM devices)
- Docker images now available for: `linux/amd64`, `linux/arm64`, `linux/arm/v7`

### 📦 Improvements

- **Dockerfile Optimization**: Improved multi-stage build with better documentation and layer caching
- **Build Performance**: Production stage no longer runs npm operations, reducing build time and complexity
- **Removed VERSION Build-Arg**: Version is now extracted from `package.json` during build, not passed as argument

--------------------------------------------------------------

## [1.2.0] - Major Architecture Overhaul

This release introduces a complete internal restructuring of the codebase for better maintainability, 
performance, and extensibility. The external API remains backwards compatible.

### ✨ Highlights

- **Clean Architecture**: Complete separation of framework (`server/`) and application (`app/`) layers
- **New Server Builder Pattern**: Declarative, fluent API for MCP server construction
- **OpenTelemetry Support**: Optional distributed tracing and metrics collection
- **Dynamic Tool Availability**: Tools are now enabled/disabled based on Komodo connection status
- **Improved Container Health Checks**: Smart readiness probes for better orchestration
- **Legacy SSE Support**: Optional backwards compatibility for older MCP clients

### 🔐 Security
- **Docker Image Signing**: All images are now signed using Sigstore/Cosign keyless signing
- **Build Attestation**: SLSA provenance is attached to all Docker images
- **SBOM Generation**: Software Bill of Materials included with every release
- **CORS Protection**: Wildcard origins blocked in production mode
- **Rate Limiting**: Configurable request limits (default: 1000/15min)
- **Session Limits**: Prevent memory exhaustion attacks

### 🚀 New Features

#### MCP Registry & npm Publishing
- **MCP Registry Publishing**: New workflow to publish to the official MCP Registry (`io.github.mp-tool/komodo-mcp-server`)
- **server.json**: Added MCP Registry metadata file for discoverability
- **npm Publishing**: New workflow for npm registry releases
- **Production Build**: Optimized builds without source maps for npm releases

#### Server Builder Pattern
Build MCP servers with a clean, declarative API:
```typescript
const server = new McpServerBuilder<KomodoClient>()
  .withOptions(serverOptions)
  .withToolProvider(toolAdapter)
  .build();
```

#### Dynamic Tool Availability
- Tools requiring Komodo connection are disabled until connected
- `komodo_configure` is always available
- MCP clients automatically receive updated tool lists

#### OpenTelemetry Observability
- Enable with `OTEL_ENABLED=true`
- Automatic tracing for all API calls and tool executions
- Metrics collection for request counts, durations, and errors
- Compatible with Jaeger, Zipkin, and Datadog (not Tested)

#### Improved Health & Readiness Probes
- `/health` - Liveness probe (always 200 if server is running)
- `/ready` - Smart readiness with accurate status codes:
  - `200` - Ready to accept traffic
  - `503` - Komodo configured but not connected
  - `429` - Session limits reached

#### Legacy SSE Transport
- Enable with `MCP_LEGACY_SSE_ENABLED=true`
- Supports older MCP clients using protocol 2024-11-05
- Both modern Streamable HTTP and legacy SSE can run simultaneously

### 🔧 Improvements

#### CI/CD Pipeline
- **Release Workflow**: Enhanced with image signing, build attestation, and improved release notes
- **Pre-release Support**: Versions with hyphen (e.g., `1.2.0-beta.1`) are now marked as pre-releases
- **Job Timeouts**: All CI jobs now have explicit timeouts for reliability
- **Dependabot**: Automated dependency updates for npm, GitHub Actions, and Docker
- **OSV Scanner**: New vulnerability scanning workflow for known CVEs

#### Performance
- **Faster Logging**: Pre-compiled regex patterns (~50-80% faster under load)
- **Cached Tool Registry**: Eliminates repeated array allocations
- **Efficient History Tracking**: O(1) circular buffer for connection state

#### Developer Experience
- **Structured Logging**: ECS-compatible JSON format for log aggregation
- **Request Cancellation**: Full AbortSignal support through all layers
- **Better Error Messages**: User-friendly recovery hints in error responses

### 📦 Configuration

New environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `OTEL_ENABLED` | Enable OpenTelemetry tracing | `false` |
| `MCP_LEGACY_SSE_ENABLED` | Enable legacy SSE transport | `false` |
| `SESSION_MAX_COUNT` | Max Streamable HTTP sessions | `100` |
| `LEGACY_SSE_MAX_SESSIONS` | Max legacy SSE sessions | `50` |

### 🔄 Migration Notes

This release is **backwards compatible**. No changes required for existing deployments.

Internal changes (for contributors):
- Source code reorganized: `src/app/` for Komodo-specific code, `src/server/` for reusable framework
- API client moved from `src/api/` to `src/app/api/`
- Configuration split into `src/app/config/` and `src/server/config/`
- Error system moved to `src/server/errors/`

--------------------------------------------------------------

## [1.1.0] - Feature Parity Release

### 🚀 New Tools
- **Container Logs**: `komodo_get_container_logs`, `komodo_search_logs`
- **Deployment Lifecycle**: pull, start, stop, restart, pause, unpause, destroy
- **Stack Lifecycle**: pull, start, stop, restart, pause, unpause, destroy

### 🔧 Improvements
- Modernized transport layer using native MCP SDK
- Improved type safety across all 44 tools
- Better AI-agent-friendly tool descriptions
- Centralized schema system for consistent validation

--------------------------------------------------------------

## [1.0.7] - Security & Auth

### 🔒 Security
- Added `helmet` middleware for HTTP security headers
- API Key authentication support (`KOMODO_API_KEY`, `KOMODO_API_SECRET`)

### 📖 Documentation
- Comprehensive JSDoc documentation for all public APIs

--------------------------------------------------------------

## [1.0.6] - Advanced Logging

### 📝 Logging System
- Structured logging with configurable levels
- Automatic sensitive data redaction
- JWT and Bearer token scrubbing
- Log injection prevention (CWE-117)
- File logging support (`LOG_DIR`)
- JSON format support (`LOG_FORMAT=json`)

--------------------------------------------------------------

## [1.0.5] - Security Hardening

### 🔒 Security
- CodeQL and OpenSSF Scorecard workflows
- Automated dependency review
- DNS rebinding protection
- Rate limiting for MCP endpoints
- Protocol version validation

### 🔄 Transport
- Migrated to Streamable HTTP Transport (MCP Spec 2025-06-18)
- Active heartbeat mechanism
- Session resilience with fault tolerance

--------------------------------------------------------------

## [1.0.4] - Architecture Refactoring

### 🏗️ Architecture
- Refactored from monolithic to modular design
- Updated to latest `@modelcontextprotocol/sdk`
- Added Zod schemas for input validation
- Dynamic tool registry system

--------------------------------------------------------------

## [1.0.0] - Initial Release

First public release of Komodo MCP Server.

### Features
- Docker container management (start, stop, restart, pause, unpause)
- Server management and monitoring
- Stack management for Docker Compose
- Deployment management
- Dual transport support (Stdio and HTTP)
