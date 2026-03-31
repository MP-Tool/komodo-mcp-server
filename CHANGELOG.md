# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

--------------------------------------------------------------

## [Unreleased]

### Security

- **Pin all GitHub Actions by SHA hash**: All workflow dependencies across 7 workflow files now reference exact commit SHAs instead of mutable version tags, preventing supply chain attacks via tag manipulation (OpenSSF Scorecard "Pinned-Dependencies")
- **Remove `dorny/paths-filter` third-party action**: Replaced with native `git diff` in `pr-check.yml` to reduce third-party dependency surface
- **Pin npm CLI version**: `publish-npm.yml` now installs `npm@11.12.1` instead of `npm@latest` for reproducible builds

### Changed

- **`MCP_JSON_RESPONSE` default changed to `false`**: Updated all config examples and documentation to reflect the new framework default. SSE streaming preserves progress and log notifications during tool execution.
- **Stage-based progress reporting**: Polling now tracks real Komodo operation stages from `update.logs[]` instead of elapsed-time-based fake progress. New stages (e.g. "Deploy Container", "Clone Repo") are reported immediately; heartbeats sent between stages. Completion reports actual duration.
- **Spec-compliant progress in terminal tools**: Terminal output progress now reports `total` alongside `progress` for determinate progress display per MCP spec.

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
