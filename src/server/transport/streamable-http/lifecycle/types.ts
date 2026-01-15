/**
 * Streamable HTTP Transport Lifecycle Types
 *
 * Type definitions for Streamable HTTP transport lifecycle management.
 * Implements MCP Streamable HTTP Transport (2025-03-26 Specification).
 *
 * @module server/transport/streamable-http/lifecycle/types
 */

// ============================================================================
// Transport State Types
// ============================================================================

/**
 * Possible states for a Streamable HTTP transport session.
 *
 * State Machine:
 * ```
 * pending ──▶ initializing ──▶ active ──▶ closing ──▶ closed
 *   ▲              │              │           │
 *   │              ▼              ▼           ▼
 *   └────────── error ◀──────────┴───────────┘
 * ```
 */
export type HttpTransportState = 'pending' | 'initializing' | 'active' | 'closing' | 'closed' | 'error';

/**
 * All possible HTTP transport states as a readonly array.
 */
export const HTTP_TRANSPORT_STATES = ['pending', 'initializing', 'active', 'closing', 'closed', 'error'] as const;

/**
 * Listener function signature for HTTP transport state changes.
 */
export type HttpTransportStateListener = (state: HttpTransportState, sessionId: string | null, error?: Error) => void;

/**
 * Event object representing an HTTP transport state transition.
 */
export interface HttpTransportStateEvent {
  /** The previous transport state */
  readonly previousState: HttpTransportState;
  /** The new (current) transport state */
  readonly currentState: HttpTransportState;
  /** Session ID of the transport */
  readonly sessionId: string;
  /** Error that caused the transition (if applicable) */
  readonly error?: Error;
  /** Timestamp when the transition occurred */
  readonly timestamp: Date;
}

// ============================================================================
// Session Lifecycle Types
// ============================================================================

/**
 * Session initialization result.
 */
export interface HttpSessionInitResult {
  /** Whether initialization was successful */
  readonly success: boolean;
  /** The session ID if successful */
  readonly sessionId?: string;
  /** Error message if initialization failed */
  readonly error?: string;
  /** Protocol version negotiated */
  readonly protocolVersion?: string;
}

/**
 * Session termination reason.
 */
export type HttpSessionTerminationReason =
  | 'client_request' // DELETE request from client
  | 'timeout' // Session expired
  | 'error' // Transport error
  | 'server_shutdown' // Server shutting down
  | 'protocol_error'; // Protocol violation

/**
 * Session termination event.
 */
export interface HttpSessionTerminationEvent {
  /** Session ID being terminated */
  readonly sessionId: string;
  /** Reason for termination */
  readonly reason: HttpSessionTerminationReason;
  /** Additional details */
  readonly details?: string;
  /** Timestamp of termination */
  readonly timestamp: Date;
}

// ============================================================================
// Request Lifecycle Types
// ============================================================================

/**
 * Tracks an HTTP request through its lifecycle.
 */
export interface HttpRequestLifecycle {
  /** Unique request ID */
  readonly requestId: string;
  /** Session ID the request belongs to */
  readonly sessionId: string;
  /** HTTP method used */
  readonly method: 'GET' | 'POST' | 'DELETE';
  /** MCP method being called (for POST) */
  readonly mcpMethod?: string;
  /** Request start timestamp */
  readonly startedAt: Date;
  /** Request completion timestamp */
  readonly completedAt?: Date;
  /** Request status */
  readonly status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

// ============================================================================
// Connection Metrics Types
// ============================================================================

/**
 * Metrics for Streamable HTTP transport.
 */
export interface HttpTransportMetrics {
  /** Total number of sessions created */
  readonly totalSessions: number;
  /** Currently active sessions */
  readonly activeSessions: number;
  /** Total requests processed */
  readonly totalRequests: number;
  /** Requests by method */
  readonly requestsByMethod: {
    readonly GET: number;
    readonly POST: number;
    readonly DELETE: number;
  };
  /** Average request duration in milliseconds */
  readonly averageRequestDurationMs: number;
  /** Number of errors */
  readonly errorCount: number;
}

/**
 * Session health status.
 */
export interface HttpSessionHealth {
  /** Session ID */
  readonly sessionId: string;
  /** Whether the session is healthy */
  readonly isHealthy: boolean;
  /** Time since last activity in milliseconds */
  readonly idleTimeMs: number;
  /** Number of active requests */
  readonly activeRequests: number;
  /** Whether an SSE stream is open */
  readonly hasSseStream: boolean;
  /** Last error if any */
  readonly lastError?: Error;
}
