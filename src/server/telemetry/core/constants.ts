/**
 * Telemetry Module Constants
 *
 * Centralized constants for the OpenTelemetry integration module including:
 * - Semantic attribute names for MCP and Komodo operations
 * - Metric attribute names
 * - Log component identifiers
 * - Log messages
 * - Metric names
 *
 * @module server/telemetry/core/constants
 */

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * Default telemetry configuration values.
 */
export const TELEMETRY_DEFAULTS = {
  /** Default service name */
  SERVICE_NAME: 'komodo-mcp-server',
  /** Default service version when not available */
  SERVICE_VERSION_FALLBACK: 'unknown',
  /** Default environment */
  ENVIRONMENT_FALLBACK: 'development',
} as const;

/**
 * Environment variable names for telemetry configuration.
 */
export const TELEMETRY_ENV_VARS = {
  /** Enable/disable OpenTelemetry */
  OTEL_ENABLED: 'OTEL_ENABLED',
  /** Custom service name */
  OTEL_SERVICE_NAME: 'OTEL_SERVICE_NAME',
  /** OTLP exporter endpoint */
  OTEL_EXPORTER_OTLP_ENDPOINT: 'OTEL_EXPORTER_OTLP_ENDPOINT',
  /** Enable debug logging */
  OTEL_DEBUG: 'OTEL_DEBUG',
  /** Package version (injected by npm) */
  NPM_PACKAGE_VERSION: 'npm_package_version',
  /** Node environment */
  NODE_ENV: 'NODE_ENV',
} as const;

// ============================================================================
// Semantic Attribute Names
// ============================================================================

/**
 * Semantic attribute names for MCP operations.
 * Follow OpenTelemetry semantic conventions pattern.
 */
export const MCP_ATTRIBUTES = {
  /** MCP tool name */
  TOOL_NAME: 'mcp.tool.name',
  /** MCP request ID */
  REQUEST_ID: 'mcp.request.id',
  /** MCP session ID */
  SESSION_ID: 'mcp.session.id',
  /** Komodo server being accessed */
  KOMODO_SERVER: 'komodo.server',
  /** Komodo resource type */
  KOMODO_RESOURCE_TYPE: 'komodo.resource.type',
  /** Komodo resource ID */
  KOMODO_RESOURCE_ID: 'komodo.resource.id',
  /** Operation being performed */
  OPERATION: 'operation',
} as const;

/**
 * Semantic attribute names for server metrics.
 */
export const METRIC_ATTRIBUTES = {
  /** Tool name being invoked */
  TOOL_NAME: 'tool.name',
  /** Transport type (http, sse, stdio) */
  TRANSPORT: 'transport',
  /** Request success status */
  SUCCESS: 'success',
  /** Error type */
  ERROR_TYPE: 'error.type',
  /** Component where error occurred */
  COMPONENT: 'component',
  /** Previous connection state */
  PREVIOUS_STATE: 'connection.state.previous',
  /** Current connection state */
  CURRENT_STATE: 'connection.state.current',
} as const;

// ============================================================================
// Metric Names
// ============================================================================

/**
 * OpenTelemetry metric instrument names.
 */
export const METRIC_NAMES = {
  /** Counter for total requests */
  REQUESTS_TOTAL: 'mcp.server.requests',
  /** Histogram for request duration */
  REQUEST_DURATION: 'mcp.server.request.duration',
  /** UpDownCounter for active sessions */
  SESSIONS_ACTIVE: 'mcp.server.sessions.active',
  /** Counter for connection state changes */
  CONNECTION_STATE_CHANGES: 'mcp.server.connection.state_changes',
  /** Counter for errors */
  ERRORS_TOTAL: 'mcp.server.errors',
  /** Gauge for server uptime */
  UPTIME: 'mcp.server.uptime',
  /** Gauge for heap memory used */
  MEMORY_HEAP_USED: 'mcp.server.memory.heap_used',
  /** Gauge for RSS memory */
  MEMORY_RSS: 'mcp.server.memory.rss',
} as const;

/**
 * Metric descriptions for documentation.
 */
export const METRIC_DESCRIPTIONS = {
  [METRIC_NAMES.REQUESTS_TOTAL]: 'Total number of MCP requests processed',
  [METRIC_NAMES.REQUEST_DURATION]: 'Duration of MCP requests in milliseconds',
  [METRIC_NAMES.SESSIONS_ACTIVE]: 'Number of active sessions',
  [METRIC_NAMES.CONNECTION_STATE_CHANGES]: 'Number of connection state changes',
  [METRIC_NAMES.ERRORS_TOTAL]: 'Total number of errors',
  [METRIC_NAMES.UPTIME]: 'Server uptime in seconds',
  [METRIC_NAMES.MEMORY_HEAP_USED]: 'Heap memory used in bytes',
  [METRIC_NAMES.MEMORY_RSS]: 'Resident set size in bytes',
} as const;

/**
 * Metric units following OpenTelemetry conventions.
 */
export const METRIC_UNITS = {
  COUNT: '1',
  MILLISECONDS: 'ms',
  SECONDS: 's',
  BYTES: 'By',
} as const;

// ============================================================================
// Log Component Identifiers
// ============================================================================

/**
 * Logger component identifiers for the telemetry module.
 * Used for consistent log categorization.
 */
export const TELEMETRY_LOG_COMPONENTS = {
  /** SDK initialization component */
  SDK: 'TelemetrySDK',
  /** Tracing utilities component */
  TRACING: 'Tracing',
  /** Metrics manager component */
  METRICS: 'Metrics',
  /** Configuration component */
  CONFIG: 'TelemetryConfig',
} as const;

// ============================================================================
// Log Messages
// ============================================================================

/**
 * Centralized log messages for SDK lifecycle.
 */
export const SdkLogMessages = {
  // Initialization
  INIT_START: 'Initializing OpenTelemetry SDK',
  INIT_SUCCESS: (serviceName: string, endpoint: string) =>
    `OpenTelemetry initialized: service=${serviceName}, endpoint=${endpoint}`,
  INIT_SKIPPED: 'OpenTelemetry disabled - skipping initialization',
  INIT_DEBUG_ENABLED: 'OpenTelemetry debug logging enabled',

  // Shutdown
  SHUTDOWN_START: 'Shutting down OpenTelemetry SDK',
  SHUTDOWN_SUCCESS: 'OpenTelemetry SDK shut down successfully',
  SHUTDOWN_ERROR: (error: string) => `Error shutting down OpenTelemetry SDK: ${error}`,
  SHUTDOWN_SKIPPED: 'OpenTelemetry SDK not initialized - nothing to shutdown',

  // Configuration
  CONFIG_LOADED: 'Telemetry configuration loaded',
} as const;

/**
 * Centralized log messages for metrics.
 */
export const MetricsLogMessages = {
  // Initialization
  INIT_SUCCESS: 'Metrics instruments initialized',
  INIT_SKIPPED: 'OpenTelemetry disabled - using in-memory tracking only',

  // Recording
  REQUEST_RECORDED: (toolName: string, durationMs: number, success: boolean) =>
    `Request recorded: tool=${toolName}, duration=${durationMs}ms, success=${success}`,
  SESSION_CHANGE: (transport: string, delta: number) => `Session change: transport=${transport}, delta=${delta}`,
  CONNECTION_STATE_CHANGE: (from: string, to: string) => `Connection state change: ${from} → ${to}`,
  ERROR_RECORDED: (errorType: string, component: string) => `Error recorded: type=${errorType}, component=${component}`,

  // Reset
  RESET: 'Metrics reset to initial state',
} as const;

// ============================================================================
// Transport Type Constants
// ============================================================================

/**
 * Known transport types for session tracking.
 */
export const TRANSPORT_TYPES = {
  HTTP: 'http',
  LEGACY_SSE: 'legacy-sse',
  STDIO: 'stdio',
} as const;
