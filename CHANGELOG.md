# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Added - Feature Parity Release
- **Container Logs Management**:
  - `komodo_get_container_logs` - Retrieve container logs with configurable tail and timestamps (stdout/stderr separated)
  - `komodo_search_logs` - Search container logs with client-side filtering (case-sensitive/insensitive)
- **Deployment Lifecycle Operations** (for Komodo-managed deployments):
  - `komodo_pull_deployment_image` - Pull the latest image without recreating the container
  - `komodo_start_deployment` - Start a stopped deployment
  - `komodo_restart_deployment` - Restart a deployment (without image pull)
  - `komodo_pause_deployment` - Pause/suspend a running deployment
  - `komodo_unpause_deployment` - Resume a paused deployment
  - `komodo_stop_deployment` - Stop a running deployment
  - `komodo_destroy_deployment` - Remove the container (deployment config preserved)
- **Stack Lifecycle Operations** (for Komodo-managed Docker Compose stacks):
  - `komodo_pull_stack` - Pull the latest images for all services (`docker compose pull`)
  - `komodo_start_stack` - Start a stopped stack (`docker compose start`)
  - `komodo_restart_stack` - Restart all services (`docker compose restart`)
  - `komodo_pause_stack` - Pause all containers (`docker compose pause`)
  - `komodo_unpause_stack` - Resume paused containers (`docker compose unpause`)
  - `komodo_destroy_stack` - Remove all containers (`docker compose down`, config preserved)
- **Configuration Module**:
  - Added `src/config/constants.ts` for centralized configuration constants
  - Added `src/config/index.ts` for unified config exports
  - Centralized error messages and default values for better maintainability

### Changed
- **Type Safety Improvements**:
  - Replaced `any` types with proper Komodo types (`KomodoServer`, `KomodoDeployment`, `KomodoStack`, `KomodoLog`)
  - Added `KomodoLog` type export for container log operations
  - Removed `@ts-ignore` / `@ts-expect-error` comments in favor of proper typing
- **Deployment Tool Enhancement**:
  - `image` parameter now accepts both string format (`"nginx:latest"`) and object format (`{ type: "Image", params: { image: "..." } }`)
  - `server_id` and `image` are now optional parameters
- **Delete Tools Enhancement**:
  - All delete operations now return and display the deleted resource object
- **Error Handling**:
  - Standardized error messages across all tools using centralized constants

### Transport Layer Enhancements
- **Modern Streamable HTTP Flow**: Implemented POST-first flow for VS Code compatibility
    - Added `createModernTransport()` for POST initialize without prior GET connection
    - Routes now detect initialize requests and create sessions automatically
    - Transport returns JSON responses with `Mcp-Session-Id` header for Modern flow
- **Session Management Improvements**:
    - Session ID detection from both `Mcp-Session-Id` header and query parameter
    - Support for both Legacy (GET+Event) and Modern (POST-first) connection flows

### Changed
- **VS Code Integration**: Updated examples to use `type: "http"` instead of `type: "sse"` for Modern Streamable HTTP support
