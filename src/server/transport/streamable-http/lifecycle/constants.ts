/**
 * Streamable HTTP Transport Lifecycle Constants
 *
 * Centralized constants for Streamable HTTP transport lifecycle management.
 * Implements MCP Streamable HTTP Transport (2025-03-26 Specification).
 *
 * @module server/transport/streamable-http/lifecycle/constants
 */

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * Streamable HTTP transport configuration constants.
 */
export const HTTP_TRANSPORT_CONFIG = {
  /**
   * Session timeout in milliseconds.
   * Sessions without activity for this duration are expired.
   */
  SESSION_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes

  /**
   * Maximum concurrent sessions.
   */
  MAX_SESSIONS: 100,

  /**
   * Request timeout in milliseconds.
   */
  REQUEST_TIMEOUT_MS: 30_000,

  /**
   * Maximum request body size in bytes.
   */
  MAX_REQUEST_SIZE_BYTES: 10 * 1024 * 1024, // 10MB

  /**
   * SSE keep-alive interval for GET /mcp endpoint.
   */
  SSE_KEEP_ALIVE_INTERVAL_MS: 30_000,
} as const;

// ============================================================================
// HTTP Headers
// ============================================================================

/**
 * MCP-specific HTTP headers per specification.
 */
export const MCP_HTTP_HEADERS = {
  /** Session ID header */
  SESSION_ID: 'Mcp-Session-Id',
  /** Protocol version header */
  PROTOCOL_VERSION: 'Mcp-Protocol-Version',
  /** Supported protocol versions */
  SUPPORTED_VERSIONS: ['2025-03-26', '2024-11-05'],
} as const;

/**
 * Standard HTTP headers used by the transport.
 */
export const HTTP_HEADERS = {
  /** Content-Type for JSON-RPC */
  CONTENT_TYPE_JSON: 'application/json',
  /** Content-Type for SSE */
  CONTENT_TYPE_SSE: 'text/event-stream',
  /** Accept header for SSE */
  ACCEPT_SSE: 'text/event-stream',
  /** Cache-Control for SSE */
  CACHE_CONTROL_SSE: 'no-cache, no-transform',
} as const;

// ============================================================================
// Log Component Identifiers
// ============================================================================

/**
 * Logger component identifiers for HTTP transport lifecycle.
 */
export const HTTP_LIFECYCLE_LOG_COMPONENTS = {
  /** HTTP transport lifecycle manager */
  LIFECYCLE: 'HttpTransportLifecycle',
  /** Session manager */
  SESSION: 'HttpSession',
  /** Request handler */
  REQUEST: 'HttpRequest',
  /** SSE stream handler */
  SSE_STREAM: 'HttpSseStream',
} as const;

// ============================================================================
// Log Messages
// ============================================================================

/**
 * Centralized log messages for HTTP transport lifecycle.
 */
export const HttpLifecycleLogMessages = {
  // Session lifecycle
  SESSION_CREATED: (sessionId: string) => `Session created: ${sessionId}`,
  SESSION_INITIALIZED: (sessionId: string) => `Session initialized: ${sessionId}`,
  SESSION_ACTIVE: (sessionId: string) => `Session active: ${sessionId}`,
  SESSION_CLOSING: (sessionId: string, reason: string) => `Session closing [${sessionId}]: ${reason}`,
  SESSION_CLOSED: (sessionId: string) => `Session closed: ${sessionId}`,
  SESSION_ERROR: (sessionId: string, error: string) => `Session error [${sessionId}]: ${error}`,
  SESSION_EXPIRED: (sessionId: string) => `Session expired: ${sessionId}`,

  // Request lifecycle
  REQUEST_RECEIVED: (sessionId: string, method: string) => `Request received [${sessionId}]: ${method}`,
  REQUEST_PROCESSING: (sessionId: string, method: string) => `Processing request [${sessionId}]: ${method}`,
  REQUEST_COMPLETED: (sessionId: string, method: string, durationMs: number) =>
    `Request completed [${sessionId}]: ${method} (${durationMs}ms)`,
  REQUEST_FAILED: (sessionId: string, method: string, error: string) =>
    `Request failed [${sessionId}]: ${method} - ${error}`,

  // SSE stream
  SSE_STREAM_OPENED: (sessionId: string) => `SSE stream opened: ${sessionId}`,
  SSE_STREAM_CLOSED: (sessionId: string) => `SSE stream closed: ${sessionId}`,
  SSE_KEEP_ALIVE_SENT: (sessionId: string) => `SSE keep-alive sent: ${sessionId}`,

  // Protocol
  PROTOCOL_VERSION_NEGOTIATED: (version: string) => `Protocol version negotiated: ${version}`,
  PROTOCOL_VERSION_UNSUPPORTED: (version: string) => `Unsupported protocol version: ${version}`,

  // Cleanup
  CLEANUP_STARTED: (count: number) => `Cleaning up ${count} HTTP sessions`,
  CLEANUP_COMPLETED: 'HTTP cleanup completed',
} as const;

// ============================================================================
// Telemetry Attributes
// ============================================================================

/**
 * OpenTelemetry attribute names for HTTP transport.
 */
export const HTTP_TELEMETRY_ATTRIBUTES = {
  /** Transport type */
  TRANSPORT_TYPE: 'mcp.transport.type',
  /** Session ID */
  SESSION_ID: 'mcp.session.id',
  /** Transport state */
  TRANSPORT_STATE: 'mcp.transport.state',
  /** HTTP method */
  HTTP_METHOD: 'http.method',
  /** MCP method */
  MCP_METHOD: 'mcp.method',
  /** Request duration */
  REQUEST_DURATION_MS: 'mcp.transport.request_duration_ms',
  /** Session duration */
  SESSION_DURATION_MS: 'mcp.transport.session_duration_ms',
  /** Protocol version */
  PROTOCOL_VERSION: 'mcp.protocol.version',
} as const;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Transport-specific error codes.
 */
export const HTTP_TRANSPORT_ERRORS = {
  /** Session not found */
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  /** Session expired */
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  /** Too many sessions */
  TOO_MANY_SESSIONS: 'TOO_MANY_SESSIONS',
  /** Invalid protocol version */
  INVALID_PROTOCOL_VERSION: 'INVALID_PROTOCOL_VERSION',
  /** Request timeout */
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  /** Request too large */
  REQUEST_TOO_LARGE: 'REQUEST_TOO_LARGE',
} as const;
