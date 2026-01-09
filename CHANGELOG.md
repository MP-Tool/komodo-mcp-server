# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

--------------------------------------------------------------

## [1.1.1] (Unreleased)

### Added
- **Resource Templates (RFC 6570)**: Full support for dynamic resource URIs with variable placeholders
  - Uses SDK's `ResourceTemplate` class for proper URI template matching
  - Supports RFC 6570 URI Template syntax (e.g., `komodo://server/{serverId}/logs`)
  - Argument validation with Zod schemas for type-safe template parameters
  - Example template: `example-server-logs.ts` demonstrating the pattern
- **MCP Notification Logger** (`mcpLogger`): Reusable logging module for sending log messages to MCP clients
  - Follows RFC 5424 syslog levels (debug, info, notice, warning, error, critical, alert, emergency)
  - Multi-server support for concurrent sessions
  - Configurable minimum log level
  - Convenience methods: `debug()`, `info()`, `warn()`, `error()`, etc.
  - Context logger factory for tool handlers
- **Connection State Manager** (`connectionManager`): Centralized Komodo connection state tracking
  - State machine: `disconnected` → `connecting` → `connected` | `error`
  - Listener notifications on state changes
  - Health check validation during connect
  - Connection history tracking (last 10 state changes)
- **Dynamic Tool Availability (Tool Gating)**: Tools are now enabled/disabled based on Komodo connection
  - `requiresClient` property on tool definitions (default: `true`)
  - `komodo_configure` always available (doesn't require connection)
  - `tools/list_changed` notification sent when availability changes
  - MCP clients automatically receive updated tool list
- **Ping/Pong Handler**: Server responds to MCP ping requests with pong notification
  - Logs `🏓 pong` via MCP notification (info level)
  - Useful for client liveness checks
- **Runtime Environment Credentials**: Fixed Docker `env_file` support
  - `getKomodoCredentials()` reads credentials at runtime (not module load time)
  - `getEnv()` safely reads environment variables with empty string handling
  - Ensures credentials from `env_file` are available after container start
- **Enhanced Health & Readiness Probes**: Improved container orchestration support
  - `/health` (Liveness): Always returns 200 if process is running, includes uptime
  - `/ready` (Readiness): Smart status codes for accurate container health:
    - `200 OK`: Server is ready to accept traffic
    - `503 Service Unavailable`: Komodo configured but not connected
    - `429 Too Many Requests`: Session limits reached (HTTP or SSE)
  - Docker HEALTHCHECK uses `/ready` for accurate container status reporting
  - Detailed session information with current/max/atLimit for each transport
  - `start_period` increased to 10s for reliable container startup
- **Legacy SSE Transport Support**: Added optional backwards compatibility for older MCP clients using the deprecated HTTP+SSE transport (protocol 2024-11-05).
  - Enable with `MCP_LEGACY_SSE_ENABLED=true` environment variable
  - Exposes endpoints: `GET /sse` (SSE stream) and `POST /sse/message` (JSON-RPC messages)
  - Both modern Streamable HTTP (`/mcp`) and legacy SSE (`/sse`) can run simultaneously
  - Default: `false` (only Streamable HTTP Transport enabled)
- **MCP Spec Compliance**: Full implementation of MCP 2025-03-26 transport specification
  - Request cancellation support via `CancelledNotification`
  - Progress reporting via `ProgressNotificationSchema`
  - Resource and Prompt registries with dynamic capability advertising
  - `RequestManager` for tracking in-flight requests with abort controller support
- **Session Limits**: Added configurable session limits to prevent memory exhaustion attacks
  - `SESSION_MAX_COUNT=100` for Streamable HTTP sessions
  - `LEGACY_SSE_MAX_SESSIONS=50` for Legacy SSE sessions
- **Example Resources & Prompts**: Renamed and documented example implementations for clarity
  - `example-server-info.ts` - Example resource demonstrating Resource Registry pattern
  - `example-troubleshoot.ts` - Example prompt demonstrating Prompt Registry pattern

### Security
- **CORS Wildcard Protection**: Wildcard `*` origin is now blocked in production mode
  - `getAllowedOrigins()` filters out `*` when `NODE_ENV=production`
  - Logs security warning when wildcard is stripped
  - Explicit origins must be specified via `MCP_ALLOWED_ORIGINS` for production
- **Enhanced DNS Rebinding Documentation**: Added security notes to middleware
  - Documents need for reverse proxy (nginx, traefik) with TLS in production
  - Clarifies that MCP endpoint relies on network isolation, not HTTP auth

### Changed
- **Tool Context**: `setClient()` is now async and returns `Promise<void>`
  - Triggers connection state change and tool availability update
  - Validates connection with health check before completing
- **Configure Tool**: Now shows available tool count after configuration
  - Displays `🔧 Tools Available: X/Y` in success message
- **Rate Limiting**: Increased rate limit from 100 to 1000 requests per 15-minute window for better development experience
- **Session ID Handling**: Fixed SDK compatibility by injecting session IDs into `rawHeaders` for `@hono/node-server`
- **DNS Rebinding Protection**: Updated middleware to allow localhost origins for development

### Fixed
- **Docker env_file Credentials**: Environment variables from `env_file` are now correctly read at runtime
  - Previously, credentials were read at module load time (before container fully started)
  - `getKomodoCredentials()` ensures runtime access to Docker-injected environment variables
- **Signal Handler**: Fixed duplicate SIGINT handlers causing unpredictable shutdown behavior
  - Consolidated shutdown logic with `shutdownInProgress` guard flag
  - Single handler for both SIGINT and SIGTERM signals

### Improved
- **Configuration Module Refactoring**: Separated config into domain-specific modules
  - `server.config.ts` - Server identity (SERVER_NAME, SERVER_VERSION)
  - `tools.config.ts` - Tool defaults (CONTAINER_LOGS_DEFAULTS, LOG_SEARCH_DEFAULTS)
  - `transport.config.ts` - Moved from `src/transport/config/` to `src/config/`
  - `errors.config.ts` - Centralized error codes and messages
- **Error Handling Centralization**: Standardized error codes and messages
  - `JsonRpcErrorCode` enum (INVALID_REQUEST, SERVER_ERROR, SESSION_NOT_FOUND, etc.)
  - `HttpStatus` enum (BAD_REQUEST, NOT_FOUND, INTERNAL_SERVER_ERROR, etc.)
  - `TransportErrorMessage` constants for consistent error responses
- **TypeScript Type Safety**: Replaced `any` casts with proper interfaces
  - Added `HeartbeatCapableTransport` interface for type-safe heartbeat access
  - `TransportSessionManager` now uses generic `Transport` interface (better testability)
- **Code Organization**: Created index.ts barrel files for transport layer modules
  - `src/transport/index.ts` - Central exports with architecture documentation
  - `src/transport/middleware/index.ts` - Middleware exports
  - `src/transport/utils/index.ts` - Utility exports
- **Import Consolidation**: All modules now use barrel exports for cleaner imports
  - `config/index.js` used throughout the codebase
  - `transport/index.js` for main entry point
  - `transport/utils/index.js` for middleware utilities
- **Health Endpoint**: Enhanced `/health` endpoint to report session counts by transport type
  - Shows `streamableHttp` session count (always)
  - Shows `legacySse` session count (when enabled)
- **Code Cleanup**: Removed unused exports identified by knip analysis
  - Removed `JSON_RPC_ERROR_CODES` (using MCP SDK error codes instead)
  - Removed `LIMITS` from public exports (kept internally for future use)
  - Removed unused schema exports (RestartModeSchema, TerminationSignalSchema, etc.)
  - Removed unused dependency `zod-to-json-schema`

--------------------------------------------------------------

## [1.0.4] (#22)

### Changed
- **Architecture Overhaul**: Refactored the entire codebase from a monolithic structure into a modular design.
    - Moved API client to `src/api/`.
    - Created dedicated tool handlers in `src/tools/` (separated by domain: container, stack, server, deployment).
    - Centralized configuration and validation in `src/config/`.
- **SDK Upgrade**: Updated to the latest `@modelcontextprotocol/sdk` using the `McpServer` class.
- **Logging**: Enforced strict usage of `stderr` for logging to ensure stability of the Stdio transport.

### Added
- **Input Validation**: Added Zod schemas for strict environment variable validation on startup.
- **Tool Registry**: Added a dynamic tool registry system to simplify adding new tools in the future.

### Removed
- **Legacy Code**: Removed deprecated `Server` class usage and monolithic tool definitions.

--------------------------------------------------------------

## [1.0.5] (#23)

### Security
- **Hardening**: Added CodeQL (SAST) and OpenSSF Scorecard workflows to ensure code security and best practices.
- **Dependency Review**: Added automated dependency review for Pull Requests to block vulnerable packages.
- **Docker Security**: Added `apk upgrade` to Dockerfile to fix OS-level vulnerabilities in the base image.
- **Protocol Validation**: Added strict validation for `MCP-Protocol-Version` header (supports 2025-06-18 & 2024-11-05).
- **Header Validation**: Enforced `Accept: text/event-stream` validation for SSE endpoints.
- **DNS Rebinding**: Implemented middleware to block DNS rebinding attacks (validates Host header).
- **Rate Limiting**: Added rate limiting for MCP endpoints to prevent DoS attacks.

### Transport Layer (Streamable HTTP)
- **Migration**: Replaced deprecated `SSEServerTransport` with `StreamableHTTPServerTransport` (MCP Spec 2025-06-18).
- **Keep-Alive**: Implemented active heartbeat mechanism (every 30s) to prevent connection timeouts.
- **Fault Tolerance**: Added session resilience tolerating up to 3 missed heartbeats before disconnection.
- **Session Management**:
    - Centralized `TransportSessionManager` with automatic cleanup of idle sessions.
    - Support for both Legacy (GET+Event) and Modern (Header-based) connection flows.
    - Fixed POST request handling to correctly map to existing SSE streams.

### Refactoring
- **Modular Architecture**: Split transport logic alinge to express convention into `config`, `middleware`, `routes`, and `utils`.
- **Central Config**: Created `src/transport/config/transport.config.ts` as the single source of truth for transport constants.

### Changed
- **CI/CD Optimization**: Replaced Dependabot with Renovate for better dependency management and reduced noise.
- **Workflow Optimization**: Optimized PR checks to skip heavy tasks (like Docker builds) on Draft PRs and only run when relevant files change.
- **Dev Experience**: Generalized `.devcontainer` configuration for public use and added useful VS Code extensions.

--------------------------------------------------------------

## [1.0.6] (#26)

### Added
- **Advanced Logging System**:
    - Implemented a robust `Logger` class with support for structured logging and log levels (`trace`, `debug`, `info`, `warn`, `error`).
    - **Context Awareness**: Integrated `AsyncLocalStorage` to track Request IDs and Session IDs across the application lifecycle.
    - **Security**: 
        - Automatic redaction of sensitive keys (e.g., `password`, `apiKey`, `token`) in log output.
        - **Secret Scrubbing**: Proactive detection and masking of JWTs and Bearer tokens.
        - **Log Injection Prevention**: Mitigation for CWE-117 by escaping newlines to prevent log forging.
    - **Formatting**: 
        - Enhanced log format with precise timestamps (`YYYY-MM-DD HH:mm:ss.SSS`) and metadata support.
        - Added support for LOGLEVEL and LOG_FORMAT configuration via environment variables.
        - Added support for JSON log format via `LOG_FORMAT=json` environment variable.
    - **File Logging**: Added support for writing logs to files via `LOG_DIR` environment variable.
    - **Transport Awareness**: Automatically routes logs to `stderr` in Stdio mode (to preserve JSON-RPC integrity) and splits `stdout`/`stderr` in SSE mode.

### Changed
- **Refactoring**:
    - Removed redundant `logSecurityStatus` function to simplify startup logic and reduce noise.
    - Updated all transport layers to utilize the new centralized logger for consistent output.
    - **Standardization**: Standardized log component tags and session management for consistent filtering.

--------------------------------------------------------------

## [1.0.7] (#29)

### Added
- **Security**: Integrated `helmet` middleware to enhance HTTP security headers for the SSE transport.
- **Authentication**: Added support for API Key authentication (`KOMODO_API_KEY`, `KOMODO_API_SECRET`) as an alternative to username/password login.

### Changed
- **Documentation**: Added comprehensive JSDoc documentation for the core `KomodoMCPServer` class, environment configuration schemas, and all tool definitions.
- **Refactoring**: Modularized the API client structure for better maintainability.
- **Stability**: Improved graceful shutdown handling for both Stdio and SSE transports to ensure clean resource release.

### Fixed
- **Tests**: Resolved issues in the test suite and improved logger mocking for tests.

--------------------------------------------------------------

## [1.1.0] (#31)

### Added
- **New MCP Tools** (Feature Parity Release):
  - **Container Logs**: `komodo_get_container_logs` (stdout/stderr with tail/timestamps), `komodo_search_logs` (client-side filtering)
  - **Deployment Lifecycle**: `pull_deployment_image`, `start/stop/restart_deployment`, `pause/unpause_deployment`, `destroy_deployment`
  - **Stack Lifecycle**: `pull_stack`, `start/stop/restart_stack`, `pause/unpause_stack`, `destroy_stack`
- **Centralized Schema System** (`src/config/descriptions.ts`):
  - Single source of truth for all Zod schema descriptions across 40+ tools
  - Organized descriptions: PARAM_DESCRIPTIONS, CONFIG_DESCRIPTIONS, LOG_DESCRIPTIONS, FIELD_DESCRIPTIONS, RESTART_MODE_DESCRIPTIONS, PRUNE_TARGET_DESCRIPTIONS, ALERT_DESCRIPTIONS, THRESHOLD_DESCRIPTIONS
  - Reusable schemas in `src/tools/schemas/` (container-operations, server-config, deployment-config, stack-config)
- **Configuration Module**: `src/config/constants.ts` and `src/config/index.ts` for centralized constants and error messages

### Changed
- **Transport Layer Modernization**:
  - Removed `transport-factory.ts` with custom `KomodoStreamableTransport` wrapper
  - Simplified to native `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk` (removed ~450 lines of custom code)
  - Eliminated dual-transport pattern (`createSecureTransport`/`createModernTransport`)
  - Removed GET-first legacy flow and endpoint events
  - Streamlined POST/GET/DELETE handlers to delegate directly to SDK
  - Enhanced middleware: Accept header validation, removed verbose logging
  - Updated MCP Spec reference to 2025-03-26
- **Type Safety**: Replaced `any` types with proper Komodo types (`KomodoServer`, `KomodoDeployment`, `KomodoStack`, `KomodoLog`), removed `@ts-ignore`/`@ts-expect-error`
- **Tool Enhancements**:
  - Deployment `image` parameter accepts both string (`"nginx:latest"`) and object format
  - Delete operations now return deleted resource objects
  - Improved AI-agent-friendly descriptions for all 44 tools
  - Standardized error messages via centralized constants
- **Logging Improvements**:
  - Shortened session IDs (8 chars), format specifiers (`%s`, `%d`) instead of templates
  - Compact logs: `timeout=30m, cleanup=60s`, `user=admin url=http://...`, `Tool [name] executing`
  - Removed redundant per-tool registration and middleware logs
- **Examples**: VS Code integration updated to use `type: "http"` (Modern Streamable HTTP)

### Removed
- **Legacy Transport Code**: `transport-factory.ts`, `logProtocolEvent`, `logSessionInitialized`, `logSessionClosed` helpers
- **Complexity**: custom transport abstraction removed
