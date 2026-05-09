# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

--------------------------------------------------------------

## [Unreleased]

### Tool Surface (Breaking)

- **Consistent naming**: All tools renamed to `komodo_<domain>_<action>` (e.g. `komodo_list_containers` → `komodo_container_list`, `komodo_get_server_info` → `komodo_server_info`, `komodo_create_api_key` → `komodo_user_create_api_key`).
- **Lifecycle consolidation**: 5 container, 8 stack and 8 deployment lifecycle tools collapsed into single `komodo_container_action` / `komodo_stack_action` / `komodo_deployment_action` tools with an `action` discriminator. Reduces `tools/list` size and avoids action-explosion in pickers.
- **Terminal consolidation**: `komodo_server_exec`, `komodo_container_exec`, `komodo_deployment_exec`, `komodo_stack_service_exec` merged into one `komodo_exec` tool with a `target` discriminated union.
- **Prune relocation**: `komodo_prune` is now `komodo_server_prune` (the underlying Komodo APIs target a server, not a container).
- **Tool count**: 51 → **30** tools.

### Added

- **Markdown renderers** in `src/utils/markdown.ts` — 16 renderers (`renderContainerList/Inspect/Logs/SearchLogs`, `renderServerList/Info/Stats`, `renderDeploymentList/Info`, `renderStackList/Info`, `renderActionResult`, `renderExecResult`, `renderApiKeyList/Created`, `renderHealthCheck`) producing rich human-readable output: bullet lists with state badges, embedded JSON blocks for inspect/info responses, fenced code blocks for logs and exec output, and multi-line action results with `Result`, `Status`, `Update ID`, `Version` plus log excerpts (last two on success, all failed/stderr stages on failure, each truncated to 1000 chars). Wired into every typed tool via the framework's new `structured(payload, { text: ... })` option.
- **`_meta.category`** on every tool — forward-compatible category metadata via new `ToolCategories` constants in `config/categories.ts`.
- **`requiredScopes`** on every tool — three-tier RBAC scopes (`komodo:read` / `komodo:operate` / `komodo:admin`) via new `ToolScopes` constants in `config/scopes.ts`. Passive today (Komodo has no OIDC yet); the framework filter activates automatically once tokens carry scopes.
- **`tools/schemas/shared.ts`** — shared Zod subschemas reused across multiple tool domains (`paginationInputSchema`, `inlineFullInputSchema`, `systemCommandSchema`, `linkedRepoSchema`, `webhookSchema`, `resourceLinkSchema`, `pageOutputSchema`).
- **Output schemas for read tools** — typed response envelopes per read-tool family in `tools/schemas/{container,server,deployment,stack}.ts` (`*ListOutputSchema`, `*InfoOutputSchema`, plus `containerInspectOutputSchema`, `containerLogsOutputSchema`, `containerSearchLogsOutputSchema`, `serverStatsOutputSchema`). Wired into `defineTool({ output: ... })` and emitted as `structuredContent` on each read tool's response, so MCP clients receive a typed payload alongside the human-readable text content.
- **Typed `structuredContent` on 11 read tools** — `komodo_container_list`, `komodo_container_inspect`, `komodo_container_logs`, `komodo_container_search_logs`, `komodo_server_list`, `komodo_server_info`, `komodo_server_stats`, `komodo_deployment_list`, `komodo_deployment_info`, `komodo_stack_list`, `komodo_stack_info` now return both human-readable text and a structured payload validated against the corresponding output schema.
- **`actionResultSchema` shared envelope** — wired into `komodo_container_action`, `komodo_deployment_action`, `komodo_stack_action`, and `komodo_server_prune`. Clients now receive `{ success, status, action, resource_type, resource_id, server?, version? }` alongside the formatted text response.
- **`buildActionResult()` utility** in `utils/polling.ts` — converts a Komodo `Update` into the `actionResultSchema` payload (mirroring `formatUpdateResult`'s human-readable output).
- **`execOutputSchema` on `komodo_exec`** — typed `{ target, command, output, exit_code, truncated, server?, container?, deployment?, stack?, service? }` payload across all four execution targets.
- **`healthCheckOutputSchema` on `komodo_health_check`** — typed `{ configured, healthy, server?, komodo_version?, mcp_server_version, error? }` payload covering the unconfigured / healthy / unhealthy / error branches.
- **API-key tool outputs** — `listApiKeysOutputSchema` on `komodo_user_list_api_keys` (returns `{ items: [{ name, key, created_at, expires }] }`) and `createApiKeyOutputSchema` on `komodo_user_create_api_key` (returns `{ name, key, secret, expires }` — secret shown only on creation).
- **`tools/schemas/{user,config}.ts`** — new schema modules covering API-key and health-check outputs, exposed via the schema barrel.

### Changed

- **Typed tool responses follow the MCP 2025-06-18 "Structured Content" recommendation**: tools that declare an `output` schema now emit `structuredContent` as the primary payload and a rich Markdown rendering in the `TextContent` block (bullet lists with state badges, embedded JSON for inspect/info, fenced code blocks for logs and exec output, multi-line action results with `Update ID` and log excerpts). Modern clients render the Markdown for the user and consume `structuredContent` for the LLM; legacy clients fall back to the same Markdown instead of a bloated JSON dump. Applies to `komodo_container_list/inspect/logs/search_logs/action`, `komodo_server_list/info/stats/prune`, `komodo_deployment_list/info/action`, `komodo_stack_list/info/action`, `komodo_user_list_api_keys`, `komodo_user_create_api_key`, `komodo_health_check`, and `komodo_exec`. State-change tools without an output schema (`komodo_configure`, all `*_create`/`*_update`/`*_delete`, `komodo_user_delete_api_key`) keep their existing human-readable Markdown.

### Removed

- **Dead Markdown formatters** in `utils/response-formatter.ts` (`formatCompletedActionResponse`, `formatListHeader`, `formatInfoResponse`, `formatErrorResponse`, `formatLogsResponse`, `formatSearchResponse`, `formatPruneResponse`) and `utils/polling.ts` (`formatUpdateResult`) — superseded by the framework's `structured()` helper for typed tools. The remaining formatters (`formatActionResponse`, `buildActionResult`) are still used by state-change and lifecycle tools.

### Schemas

- **Schemas**: per-domain action enums and discriminated input schemas added to `tools/schemas/{container,deployment,stack}.ts`; new `tools/schemas/terminal.ts` with the `komodo_exec` discriminated union.
- **Stack config**: `stackConfigSchema` now composes `linkedRepoSchema` and `webhookSchema` from `tools/schemas/shared.ts` via `.merge()` instead of inlining the git/webhook fields.
- **Optional `state` on summary schemas** — `containerSummarySchema`, `serverSummarySchema`, `deploymentSummarySchema`, and `stackSummarySchema` now mark `state` as optional. The `state: "unknown"` placeholder previously emitted by `*_inspect` / `*_info` / `*_logs` / `*_search_logs` is dropped — the field is simply omitted when the underlying read API does not return it.

### Dependencies

- Bumped `mcp-server-framework` from `^1.0.5` to `^1.1.0`. `1.1.0` exposes `output: ZodTypeAny` on `defineTool()` (forwarded to the SDK as `outputSchema`), `structuredContent` on the response helpers, the `structured()` helper that emits `structuredContent` as the primary payload plus a `TextContent` fallback per the MCP 2025-06-18 spec, and `StructuredResponseOptions` (with an optional `text` override) so typed tools can render rich Markdown for client UIs while `structuredContent` stays the single source of truth for the LLM.

### Migration

Tool names changed across the board. Update any client prompts, scripts or chat instructions that hard-code the old `komodo_list_*` / `komodo_get_*` / `komodo_*_container` names.

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
