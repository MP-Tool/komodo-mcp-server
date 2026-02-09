# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### 📦 Improvements

- **Optimized Docker Build**: Reduced unnecessary steps and improved layer caching
  - Copy only `src/` and `tsconfig*.json` instead of entire context
  - Removed `curl` from builder stage (only needed in production for healthcheck)
  - Combined multiple `LABEL` statements into one
- **Build Metadata**: Embedded VERSION, BUILD_DATE, and COMMIT_SHA into container
  - Files available at `/app/build/VERSION`, `/app/build/BUILD_DATE`, `/app/build/COMMIT_SHA`
  - OCI labels include version, created date, and revision
- **GHCR Metadata Fix**: Added `DOCKER_METADATA_ANNOTATIONS_LEVELS: manifest,index` to CI
  - Fixes missing description in GitHub Container Registry for multi-arch images

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
