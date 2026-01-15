# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

--------------------------------------------------------------

## [1.1.1] (Unreleased)

### Added
- **Framework/App Architecture Separation**: Prepared `server/` module for future extraction as reusable MCP framework
  - **New `src/server/types/` module**: Generic framework interfaces
    - `IApiClient`: Generic API client interface with `healthCheck()` and `clientType`
    - `IToolContext<TClient>`: Generic tool context with typed client support
    - `IHealthCheckResult`: Generic health check result interface
    - `isApiClient()`: Type guard for runtime API client validation
  - **New `src/app/` layer**: Komodo-specific bootstrap logic (moved from server/)
    - `komodoConnectionManager`: Typed `ConnectionStateManager<KomodoClient>` instance
    - `initializeKomodoClientFromEnv()`: Komodo-specific client initialization
  - **Config separation**: Split environment configuration into framework and app layers
    - `env.framework.ts`: Transport, OTEL, logging, rate limiting (generic MCP config)
    - `env.app.ts`: KOMODO_URL, KOMODO_USERNAME, KOMODO_PASSWORD, KOMODO_API_KEY
  - **New `src/server/transport/core/` module**: Centralized transport constants
    - `JSON_RPC_ERROR_CODES`: Standard JSON-RPC 2.0 error codes
    - `TRANSPORT_ERROR_CODES`: MCP-specific error codes
    - `HTTP_STATUS`: Common HTTP status codes
    - `TRANSPORT_LOG_COMPONENTS`: Centralized logger component names
    - `McpServerFactory`, `TransportType`, `TransportConfig` types
  - **Generic ConnectionStateManager**: Now `ConnectionStateManager<TClient extends IApiClient>`
    - Type-safe client storage and retrieval
    - Works with any API client implementing `IApiClient`
  - **Typed Tool Context**: `ToolContext = IToolContext<KomodoClient>` with Komodo-specific typing
- **Transport Integration Tests** (`tests/integration/transport-*.test.ts`): Comprehensive transport mode testing
  - `transport-stdio.test.ts`: 9 tests for stdio transport (JSON-RPC over stdin/stdout)
  - `transport-http.test.ts`: 12 tests for Streamable HTTP Transport (2025-03-26)
  - `transport-http-sse.test.ts`: 8 tests for Legacy SSE Transport (2024-11-05)
  - `transport-cross.test.ts`: 8 tests verifying consistent behavior across all transport modes
  - Tests cover: protocol compliance, session management, concurrent connections, error handling
- **New Test Script** (`npm run test:transport`): Run all transport integration tests
- **AbortSignal Propagation**: Full request cancellation support through all layers
  - `ApiOperationOptions` interface with optional `signal?: AbortSignal` parameter
  - `BaseResource.checkAborted()` helper method for consistent cancellation checks
  - All API resource methods (`containers`, `servers`, `stacks`, `deployments`) accept AbortSignal
  - All 40+ tool handlers pass `abortSignal` to API calls for proper cancellation
- **Zod Input Validation Schemas** (`src/api/utils.ts`): Centralized input validation for API resources
  - `serverIdSchema`, `containerNameSchema`, `stackIdSchema`, `deploymentIdSchema` for resource IDs
  - `tailSchema` for log tail parameter validation (positive integer ≥ 1)
  - `resourceNameSchema` for generic resource names with min length validation
  - Helper functions: `validateServerId()`, `validateContainerName()`, etc.
- **MCP-COMPLIANCE.md**: Comprehensive MCP specification compliance documentation
  - Compliance matrix for transport, lifecycle, resources, tools, prompts
  - Security feature documentation (request cancellation, rate limiting)
  - Testing coverage information and architecture overview
- **Logger Shutdown** (`Logger.closeStreams()`): Graceful file handle cleanup
  - Closes stdout/stderr file streams before process exit
  - Prevents file descriptor leaks on shutdown
- **Framework Error System** (`src/server/errors/`): Complete modular error architecture for MCP framework
  - **Modular Core Structure** (`core/`): Clean separation of concerns
    - `error-codes.ts` - Application error codes (`ErrorCodes`) and categories (`ErrorCategory`)
    - `http.ts` - HTTP status codes (`HttpStatus`) and error code mapping (`ErrorCodeToHttpStatus`)
    - `json-rpc.ts` - JSON-RPC 2.0 spec-compliant error codes with validation helpers
    - `validation.ts` - Validation constants and sensitive field redaction utilities
    - `types.ts` - Pure TypeScript type definitions (interfaces only, no runtime values)
    - `messages.ts` - Framework error messages with interpolation support
    - `base.ts` - `AppError` base class with unique error IDs and serialization
    - `index.ts` - Barrel file for clean imports
  - **Error Category Classes** (`categories/`):
    - `McpProtocolError`, `SessionError`, `TransportError` - MCP protocol errors
    - `ValidationError`, `ConfigurationError` - Input validation errors
    - `InternalError`, `RegistryError` - System/internal errors
    - `OperationError`, `OperationCancelledError` - Operation lifecycle errors
    - `FrameworkConnectionError` - Generic connection errors (extendable for app-specific)
  - **FrameworkErrorFactory** (`factory.ts`): Centralized error creation with fluent API
    - Category-organized factory methods (`mcp.`, `session.`, `validation.`, etc.)
    - Type guards and normalization utilities
  - **Design Principles**: DRY, single source of truth for constants, barrel file exports
- **Test Configurations**: Multiple Vitest configurations for different test scenarios
  - `vitest.ci.config.ts` - CI/CD optimized with JUnit reporter and coverage thresholds
  - `vitest.e2e.config.ts` - E2E tests with extended timeouts and sequential execution
  - `vitest.extended.config.ts` - Extended test suite including smoke, security, load tests
- **Transport Layer Tests** (`tests/unit/server/transport/`):
  - `session.test.ts` - Session management lifecycle tests
  - `utils/json-rpc.test.ts` - JSON-RPC utility function tests
  - `utils/logging.test.ts` - Transport logging utility tests
- **Utility Tests** (`tests/unit/utils/`):
  - `env-helpers.test.ts` - Environment variable helper tests
  - `response-formatter.test.ts` - Response formatting utility tests
- **Structured JSON Logging** (`src/utils/logger/log-schema.ts`): ECS-compatible structured log format
  - `StructuredLogEntry` interface following Elastic Common Schema (ECS) 8.x
  - `LogEntryBuilder` fluent API for constructing log entries
  - Support for service metadata, trace context, HTTP context, error details
  - Numeric log severity (`log.level`) for easy filtering
  - `@timestamp` in ISO 8601 format for log aggregation (ELK, Datadog, Splunk)
- **OpenTelemetry Tracing** (`src/server/telemetry/tracing.ts`): Distributed tracing support
  - Optional activation via `OTEL_ENABLED=true` environment variable
  - `withSpan()` and `withSpanSync()` helpers for creating spans
  - Auto-instrumentation for HTTP, Express, and other modules
  - OTLP exporter for Jaeger, Zipkin, Datadog compatibility
  - `MCP_ATTRIBUTES` semantic conventions for MCP operations
  - Graceful shutdown with `shutdownTelemetry()`
- **OpenTelemetry Metrics** (`src/server/telemetry/metrics.ts`): Server performance metrics
  - `ServerMetricsManager` class for centralized metric collection
  - Request metrics: count, duration histogram, success/failure tracking
  - Session metrics: active HTTP and SSE session gauges
  - Connection state metrics: state transition counters
  - Error metrics: categorized by type and component
  - `getStats()` method for runtime statistics snapshot
  - Falls back to in-memory tracking when OpenTelemetry is disabled
- **Knip Configuration** (`knip.json`): Unused code detection configuration
  - Project scope: `src/**/*.ts`
  - Ignores: test files to avoid false positives
- **Resource Templates (RFC 6570)**: Full support for dynamic resource URIs with variable placeholders
  - Uses SDK's `ResourceTemplate` class for proper URI template matching
  - Supports RFC 6570 URI Template syntax (e.g., `komodo://server/{serverId}/logs`)
  - Argument validation with Zod schemas for type-safe template parameters
  - Example template: `example-server-logs.ts` demonstrating the pattern
- **MCP Notification Logger** (`src/utils/logger/mcp-logger.ts`): Reusable logging module for sending log messages to MCP clients
  - Follows RFC 5424 syslog levels (debug, info, notice, warning, error, critical, alert, emergency)
  - Multi-server support for concurrent sessions
  - Configurable minimum log level
  - Convenience methods: `debug()`, `info()`, `warn()`, `error()`, etc.
  - Context logger factory for tool handlers
- **Connection State Manager** (`src/server/utils/connection-state.ts`): Centralized Komodo connection state tracking
  - State machine: `disconnected` → `connecting` → `connected` | `error`
  - Listener notifications on state changes
  - Health check validation during connect
  - Connection history tracking (last 10 state changes) with circular buffer
  - **OpenTelemetry integration**: spans and events for connection lifecycle
  - **Metrics integration**: records state transitions via `serverMetrics`
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
  - `RequestManager` (`src/server/utils/request-manager.ts`) for tracking in-flight requests with abort controller support
- **Session Limits**: Added configurable session limits to prevent memory exhaustion attacks
  - `SESSION_MAX_COUNT=100` for Streamable HTTP sessions
  - `LEGACY_SSE_MAX_SESSIONS=50` for Legacy SSE sessions
- **Example Resources & Prompts**: Renamed and documented example implementations for clarity
  - `example-server-info.ts` - Example resource demonstrating Resource Registry pattern
  - `example-troubleshoot.ts` - Example prompt demonstrating Prompt Registry pattern
- **Formatting Utilities** (`src/utils/logger/core/format.ts`): Logger-specific formatting helpers
  - `formatSessionId()` - Truncates session IDs to 8 chars for consistent logging
  - `formatRequestId()` - Truncates request IDs for log output
  - `formatTraceId()` - Truncates trace IDs for log output
  - Configurable length constants (`SESSION_ID_LOG_LENGTH`, `REQUEST_ID_LOG_LENGTH`, `TRACE_ID_LOG_LENGTH`)

### Performance
- **Logger Regex Pre-Compilation**: Secret scrubbing regex patterns compiled once at module load
  - `SCRUB_JWT_REGEX`, `SCRUB_BEARER_REGEX`, `SCRUB_KV_REGEX` pre-compiled
  - Eliminates regex compilation overhead on every log call
  - ~50-80% faster logging under high volume
- **Tool Registry Caching**: Cached tool arrays to avoid repeated `Array.from()` calls
  - `cachedAllTools`, `cachedAvailableTools`, `cachedClientRequired`, `cachedAlwaysAvailable`
  - Cache invalidation on tool registration and connection state changes
  - Eliminates O(n) array creation on every tool lookup
- **Circular Buffer for Connection History**: O(1) history management
  - Replaced `array.push()` + `array.shift()` with circular buffer
  - `shift()` was O(n), circular buffer index update is O(1)
  - Memory-efficient fixed-size history storage

### Security
- **CORS Wildcard Protection**: Wildcard `*` origin is now blocked in production mode
  - `getAllowedOrigins()` filters out `*` when `NODE_ENV=production`
  - Logs security warning when wildcard is stripped
  - Explicit origins must be specified via `MCP_ALLOWED_ORIGINS` for production
- **Enhanced DNS Rebinding Documentation**: Added security notes to middleware
  - Documents need for reverse proxy (nginx, traefik) with TLS in production
  - Clarifies that MCP endpoint relies on network isolation, not HTTP auth

### Refactored
- **Error System Architecture** (`src/server/errors/`): Complete restructuring from `src/utils/errors/`
  - Moved from `utils/errors/` to `server/errors/` for framework/app separation
  - Split monolithic `constants.ts` and `types.ts` into domain-specific modules:
    - `error-codes.ts` - Error codes and categories (no HTTP/JSON-RPC concerns)
    - `http.ts` - HTTP status codes with typed mapping to error codes
    - `json-rpc.ts` - JSON-RPC error codes with spec validation helpers
    - `validation.ts` - Validation limits and sensitive field detection
    - `types.ts` - Pure type definitions (interfaces only)
  - Introduced barrel files (`index.ts`) for clean sub-module imports
  - Removed duplication: HTTP status codes now defined once with typed mapping
  - `FrameworkErrorFactory` replaces `ErrorFactory` with framework-agnostic API
- **Transport Middleware**: All middleware now uses centralized constants from `transport/core/constants.ts`
  - Replaced magic numbers with `HTTP_STATUS.*` and `JSON_RPC_ERROR_CODES.*`
  - Consistent logger component names via `TRANSPORT_LOG_COMPONENTS`
- **Connection Module**: Extracted app-specific logic to `src/app/`
  - `initializeClientFromEnv()` moved to `src/app/client-initializer.ts` as `initializeKomodoClientFromEnv()`
  - Connection manager instance moved to `src/app/connection.ts`
  - Framework-level `ConnectionStateManager` is now generic and reusable
- **Tool Base Module**: Simplified with Komodo-specific type aliases
  - `ToolContext = IToolContext<KomodoClient>` for cleaner tool implementations
  - `Tool<T, TClient = KomodoClient>` interface with sensible defaults
- **Health Check Tool**: Added type guard `isKomodoHealthCheckDetails()` for type-safe detail access

### Changed
- **Tool Context**: `setClient()` is now async and returns `Promise<void>`
  - Triggers connection state change and tool availability update
  - Validates connection with health check before completing
- **Configure Tool**: Now shows available tool count after configuration
  - Displays `🔧 Tools Available: X/Y` in success message
- **Rate Limiting**: Increased rate limit from 100 to 1000 requests per 15-minute window for better development experience
- **Session ID Handling**: Fixed SDK compatibility by injecting session IDs into `rawHeaders` for `@hono/node-server`
- **DNS Rebinding Protection**: Updated middleware to allow localhost origins for development
- **Prompts Type Safety**: `PromptArguments` type replaces `any` in prompt definitions
  - `Record<string, string | number | boolean | undefined>` for type-safe prompt args
- **JSON Logging Format**: Upgraded to ECS-compatible structured logging
  - `@timestamp` instead of `timestamp` for ECS compliance
  - `log.level` numeric severity for filtering
  - `metadata` field for custom data instead of spreading at root level
  - `labels.request_id` for easy request tracking

### Dependencies
- **Added**: OpenTelemetry packages for distributed tracing
  - `@opentelemetry/api` - Core tracing API
  - `@opentelemetry/sdk-node` - Node.js SDK
  - `@opentelemetry/auto-instrumentations-node` - Auto instrumentation
  - `@opentelemetry/exporter-trace-otlp-http` - OTLP exporter

### Fixed
- **Docker env_file Credentials**: Environment variables from `env_file` are now correctly read at runtime
  - Previously, credentials were read at module load time (before container fully started)
  - `getKomodoCredentials()` ensures runtime access to Docker-injected environment variables
- **Signal Handler**: Fixed duplicate SIGINT handlers causing unpredictable shutdown behavior
  - Consolidated shutdown logic with `shutdownInProgress` guard flag
  - Single handler for both SIGINT and SIGTERM signals
- **API Error Handling**: Removed try/catch blocks with silent returns in API resources
  - Errors now propagate correctly through the call stack
  - Consistent error handling across all API methods

### Removed
- **Unused Utilities** (`src/tools/utils/`): Removed entire directory
  - `action-factory.ts` - Never used action factory pattern
  - `index.ts` - Barrel export file

### Improved
- **Session Module Architecture Overhaul** (`src/server/session/`): Complete restructuring for maintainability and extensibility
  - **Modular File Structure**: Reorganized session management into layered architecture:
    - `core/` - Types, constants, events, metrics, errors, Zod schemas
    - `operations/` - Pure functions for lifecycle, cleanup, heartbeat operations
    - `utils/` - Formatting and validation utilities
    - `session-manager.ts` - Main `TransportSessionManager` class
  - **Enhanced Error Classes**:
    - `SessionError` base class with MCP error code mapping
    - `SessionLimitError`, `SessionNotFoundError`, `SessionExpiredError`, `SessionInvalidError`
    - `SessionManagerShutdownError` for graceful shutdown handling
    - Type guards for error instance checking
  - **Observability Features**:
    - `SessionEventEmitter` for lifecycle event tracking (created, expired, removed, etc.)
    - `SessionMetricsCollector` with OpenTelemetry integration
    - `DetailedSessionMetrics` snapshot for monitoring
  - **Zod Schema Validation** (`core/schemas.ts`):
    - `SessionConfigSchema` with cross-field validation refinements
    - `SessionIdSchema` for ID format validation
    - Helper functions: `parseSessionConfig()`, `validateSessionConfigSafe()`
    - Validation limits and custom error messages
  - **Type Safety Improvements**:
    - `HeartbeatCapableTransport` interface with type guard `hasHeartbeat()`
    - `ISessionManager` interface for consistent contract
    - Factory functions for isolated instances (`createSessionMetrics()`, `createSessionEventEmitter()`)
- **Handlers Module Architecture** (`src/server/handlers/`): Professional restructuring for maintainability
  - **Modular File Structure**: Reorganized into layered architecture:
    - `core/types.ts` - Handler types (`HandlerType`, `HandlerDefinition`, `HandlerMetadata`, etc.)
    - `core/constants.ts` - Centralized constants (`HANDLER_NAMES`, `MCP_SPEC_URLS`, `HandlerLogMessages`)
    - `ping.ts` - Ping handler with `HandlerDefinition` export
    - `cancellation.ts` - Cancellation handler with `HandlerDefinition` export
  - **Type Safety**: All handlers export `HandlerDefinition` interface for programmatic registration
  - **MCP Spec Compliance**: Handler metadata includes spec URLs and version references
  - **Re-Exports**: Handler types and constants available via `src/server/index.ts`
- **Error System Architecture Overhaul** (`src/utils/errors/`): Complete restructuring for maintainability and extensibility
  - **Modular File Structure**: Reorganized flat error files into layered architecture:
    - `core/` - Base class (`AppError`), types, constants, message registry
    - `categories/` - Domain-specific error classes (API, Validation, Operation, MCP, System)
    - `factory.ts` - `ErrorFactory` with sub-factories for consistent error creation
  - **New Error Categories**:
    - `McpProtocolError` - Protocol violations and invalid requests
    - `SessionError` - Session management failures
    - `TransportError` - Transport layer errors
    - `InternalError` - Internal server errors
    - `RegistryError` - Registry/initialization errors
  - **Enhanced Error Features**:
    - `errorId` (UUID) - Unique identifier for tracking/support
    - `recoveryHint` - User-friendly guidance for error resolution
    - `getMessage()` - Centralized message registry with template interpolation (70+ messages)
    - Automatic HTTP/MCP status code mapping via `ErrorCodeToHttpStatus`
  - **ErrorFactory Pattern**: Type-safe error creation with domain-specific sub-factories
    - `ErrorFactory.api.*` - API-related errors (serverNotFound, connectionFailed, etc.)
    - `ErrorFactory.validation.*` - Input validation errors (fieldRequired, invalidFormat, etc.)
    - `ErrorFactory.operation.*` - Operation errors (cancelled, failed, clientNotConfigured)
    - `ErrorFactory.mcp.*` - MCP protocol errors (invalidRequest, sessionExpired, etc.)
    - `ErrorFactory.system.*` - System errors (internal, registryError)
  - **Security**: Sensitive field detection (`isSensitiveField()`) for automatic data redaction
  - **Constants**: `JsonRpcErrorCode`, `HttpStatus`, `VALIDATION_LIMITS`, `SENSITIVE_FIELD_PATTERNS`
- **Logger Module Architecture Overhaul** (`src/utils/logger/`): Complete restructuring for maintainability
  - **Modular File Structure**: Split monolithic `logger.ts` (~1200 lines) into focused modules:
    - `core/` - Core types, config, context, format utilities
    - `formatters/` - TextFormatter, JsonFormatter with strategy pattern
    - `processors/` - Security (scrubbing, injection guard), LogProcessor pipeline
    - `writers/` - ConsoleWriter, FileWriter, McpWriter with WriterManager
    - `factory.ts` - LoggerResources for testable resource management
  - **Context Management**: Per-context depth tracking via `contextDepth` Map
    - Fixes cross-context depth pollution in concurrent requests
    - AsyncLocalStorage store now contains depth per context ID
  - **Secret Scrubbing Enhancements**:
    - JWT detection: Header.Payload pattern with `[JWT:xxx...]` replacement
    - Bearer tokens: `Authorization: Bearer xxx` → `[BEARER:xxx...]`
    - Key-value patterns: `password=xxx`, `api_key: xxx`, `secret = xxx`
    - All patterns handle quotes, various delimiters, and edge cases
  - **Injection Guard (CWE-117)**: Log forging protection
    - Escapes `\n`, `\r`, `\t` in log messages
    - Prevents multi-line log injection attacks
  - **Writer System**: Pluggable output destinations
    - `ConsoleWriter` - stdout/stderr with transport-aware routing
    - `FileWriter` - Rotating file output with LOG_DIR support
    - `McpWriter` - MCP notification logging to connected clients
    - `WriterManager` - Coordinates multiple writers with level filtering
  - **Formatter Strategy Pattern**: Swappable output formats
    - `TextFormatter` - Human-readable with colors and emojis
    - `JsonFormatter` - ECS-compatible structured JSON
    - Both implement `LogFormatter` interface
  - **Factory Pattern** (`LoggerResources`): Dependency injection for testing
    - Inject custom formatters, writers, context providers
    - Enables isolated unit tests without global state
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
- **Telemetry Module Architecture Overhaul** (`src/server/telemetry/`): Complete restructuring for maintainability
  - **Modular File Structure**: Reorganized into layered architecture:
    - `core/config.ts` - Telemetry configuration wrapper
    - `core/constants.ts` - Centralized constants (OTEL_ATTRIBUTES, MCP_ATTRIBUTES, TELEMETRY_ENV_VARS)
    - `core/types.ts` - All type definitions (TelemetryConfig, SpanOptions, TraceContext, ServerMetrics)
    - `core/index.ts` - Barrel exports for core module
    - `sdk.ts` - SDK lifecycle management (initializeTelemetry, shutdownTelemetry)
  - **OpenTelemetry Semantic Conventions**: Updated to stable `@opentelemetry/semantic-conventions`
    - Uses `ATTR_*` exports (stable) instead of deprecated `SEMATTRS_*`
    - `ATTR_DEPLOYMENT_ENVIRONMENT_NAME` from `/incubating` for environment attribute
  - **Error Handling in Metrics**: All metric recording wrapped in try/catch
    - Prevents telemetry failures from crashing the application
    - Errors logged with context for debugging
  - **Factory Pattern**: `createServerMetrics()` for isolated, testable instances
  - **Type Re-exports**: Core OpenTelemetry types (Span, Attributes, Context, SpanKind) re-exported from core/
 - `transport/utils/index.js` for middleware utilities
- **Health Endpoint**: Enhanced `/health` endpoint to report session counts by transport type
  - Shows `streamableHttp` session count (always)
  - Shows `legacySse` session count (when enabled)
- **Code Cleanup**: Removed unused exports identified by knip analysis
  - Removed `JSON_RPC_ERROR_CODES` (using MCP SDK error codes instead)
  - Removed `LIMITS` from public exports (kept internally for future use)
  - Removed unused schema exports (RestartModeSchema, TerminationSignalSchema, etc.)
  - Removed unused dependency `zod-to-json-schema`
- **Type Safety Improvements**: Enhanced TypeScript strict typing throughout the codebase
  - `ResourceTemplate<TArgs>`: Generic type parameter for handler arguments
  - `ResourceListItem`: New interface for resource list callback results
  - `KomodoServerState`: Proper type for server state responses (replaces `unknown`)
  - `ServerState` enum: Re-exported from komodo_client for type-safe status values
  - Container actions: `const` assertion for type-safe execute API calls
  - Prune actions: `actionMap` with `as const` for proper literal type inference
  - `progressToken` extraction: Inline type instead of `as any` cast
  - Documented `any` usage with `eslint-disable` comments explaining rationale
- **Module Organization**: Added barrel files (`index.ts`) for cleaner imports
  - `src/server/index.ts`: Server initialization and exports
  - `src/server/utils/index.ts`: Connection state, request manager, handlers, client initializer
  - `src/server/telemetry/index.ts`: OpenTelemetry tracing and metrics exports
  - `src/server/transport/index.ts`: HTTP server, session manager, transports
  - `src/server/transport/routes/index.ts`: MCP and health route handlers
  - `src/server/transport/utils/index.ts`: JSON-RPC helpers, logging utilities
  - `src/utils/index.ts`: Logger, errors, format utilities
  - `src/utils/logger/index.ts`: Logger, MCP logger, log schema, formatSessionId
  - `src/utils/errors/index.ts`: KomodoError hierarchy exports
  - `src/api/resources/index.ts`: API resource classes
  - `src/mcp/tools/index.ts`: Tool registry and tool exports
- **Code Extraction**: Refactored large functions into dedicated modules
  - `src/server/utils/handlers.ts`: Cancellation and Ping handlers
  - `src/server/utils/client-initializer.ts`: Environment-based client initialization
- **Resource Template Discovery**: Implemented `list` callback for Resource Templates
  - Templates can now enumerate available resources for MCP clients
  - Example template demonstrates mock server discovery

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
