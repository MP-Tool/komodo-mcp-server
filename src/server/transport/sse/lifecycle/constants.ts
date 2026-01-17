/**
 * SSE Transport Lifecycle Constants
 *
 * Centralized constants for SSE transport lifecycle management.
 *
 * @module server/transport/sse/lifecycle/constants
 */

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * SSE transport configuration constants.
 */
export const SSE_TRANSPORT_CONFIG = {
  /**
   * Keep-alive interval for SSE connections (ms).
   * SSE comment lines are sent at this interval to keep the connection alive.
   */
  KEEP_ALIVE_INTERVAL_MS: 30_000,

  /**
   * Timeout for considering a connection stale (ms).
   * If no activity for this duration, connection is considered unhealthy.
   */
  STALE_TIMEOUT_MS: 60_000,

  /**
   * Buffer size for SSE event queue.
   */
  EVENT_BUFFER_SIZE: 100,

  /**
   * Maximum retry attempts for failed message sends.
   */
  MAX_SEND_RETRIES: 3,
} as const;

/**
 * SSE reconnection default configuration.
 */
export const SSE_RECONNECTION_DEFAULTS = {
  /** Whether automatic reconnection is enabled by default */
  ENABLED: false,
  /** Initial delay before first reconnection attempt (ms) */
  INITIAL_DELAY_MS: 1_000,
  /** Maximum delay between reconnection attempts (ms) */
  MAX_DELAY_MS: 30_000,
  /** Multiplier for exponential backoff */
  BACKOFF_MULTIPLIER: 2,
  /** Maximum number of reconnection attempts (0 = infinite) */
  MAX_ATTEMPTS: 5,
} as const;

// ============================================================================
// Log Component Identifiers
// ============================================================================

/**
 * Logger component identifiers for SSE transport lifecycle.
 */
export const SSE_LIFECYCLE_LOG_COMPONENTS = {
  /** SSE transport lifecycle manager */
  LIFECYCLE: 'SseTransportLifecycle',
  /** SSE connection handler */
  CONNECTION: 'SseConnection',
  /** SSE stream handler */
  STREAM: 'SseStream',
  /** SSE reconnection handler */
  RECONNECTION: 'SseReconnection',
} as const;

// ============================================================================
// SSE Event Names
// ============================================================================

/**
 * Standard SSE event names used by the transport.
 */
export const SSE_EVENT_NAMES = {
  /** Endpoint event sent on connection */
  ENDPOINT: 'endpoint',
  /** Message event for JSON-RPC messages */
  MESSAGE: 'message',
  /** Keep-alive comment (not a named event) */
  KEEP_ALIVE: ':keep-alive',
  /** Error event */
  ERROR: 'error',
} as const;

// ============================================================================
// Log Messages
// ============================================================================

/**
 * Centralized log messages for SSE transport lifecycle.
 */
export const SseLifecycleLogMessages = {
  // Connection lifecycle
  CONNECTION_STARTED: (sessionId: string) => `SSE connection started: ${sessionId}`,
  CONNECTION_ESTABLISHED: (sessionId: string) => `SSE connection established: ${sessionId}`,
  CONNECTION_CLOSED: (sessionId: string) => `SSE connection closed: ${sessionId}`,
  CONNECTION_ERROR: (sessionId: string, error: string) => `SSE connection error [${sessionId}]: ${error}`,

  // Stream lifecycle
  STREAM_STARTED: (sessionId: string) => `SSE stream started: ${sessionId}`,
  STREAM_ENDED: (sessionId: string) => `SSE stream ended: ${sessionId}`,
  STREAM_WRITE_ERROR: (sessionId: string, error: string) => `SSE stream write error [${sessionId}]: ${error}`,

  // Keep-alive
  KEEP_ALIVE_SENT: (sessionId: string) => `Keep-alive sent: ${sessionId}`,
  KEEP_ALIVE_FAILED: (sessionId: string, error: string) => `Keep-alive failed [${sessionId}]: ${error}`,

  // Message handling
  MESSAGE_SENT: (sessionId: string, event: string) => `SSE event sent [${sessionId}]: ${event}`,
  MESSAGE_SEND_FAILED: (sessionId: string, error: string) => `SSE message send failed [${sessionId}]: ${error}`,

  // Reconnection
  RECONNECTION_STARTED: (sessionId: string, attempt: number) => `Reconnection attempt ${attempt} for: ${sessionId}`,
  RECONNECTION_SUCCESS: (sessionId: string) => `Reconnection successful: ${sessionId}`,
  RECONNECTION_FAILED: (sessionId: string, error: string) => `Reconnection failed [${sessionId}]: ${error}`,
  RECONNECTION_EXHAUSTED: (sessionId: string, attempts: number) =>
    `Reconnection exhausted after ${attempts} attempts: ${sessionId}`,

  // Cleanup
  CLEANUP_STARTED: (count: number) => `Cleaning up ${count} SSE connections`,
  CLEANUP_COMPLETED: 'SSE cleanup completed',
} as const;

// ============================================================================
// Telemetry Attributes
// ============================================================================

/**
 * OpenTelemetry attribute names for SSE transport.
 */
export const SSE_TELEMETRY_ATTRIBUTES = {
  /** Transport type */
  TRANSPORT_TYPE: 'mcp.transport.type',
  /** Session ID */
  SESSION_ID: 'mcp.session.id',
  /** Transport state */
  TRANSPORT_STATE: 'mcp.transport.state',
  /** Connection duration */
  CONNECTION_DURATION_MS: 'mcp.transport.connection_duration_ms',
  /** Messages sent count */
  MESSAGES_SENT: 'mcp.transport.messages_sent',
  /** Bytes sent */
  BYTES_SENT: 'mcp.transport.bytes_sent',
  /** Reconnection attempt */
  RECONNECTION_ATTEMPT: 'mcp.transport.reconnection_attempt',
} as const;
