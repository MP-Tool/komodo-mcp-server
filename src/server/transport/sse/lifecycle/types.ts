/**
 * SSE Transport Lifecycle Types
 *
 * Type definitions for SSE transport lifecycle management.
 *
 * @module server/transport/sse/lifecycle/types
 */

import type { SseTransport } from '../transport.js';

// ============================================================================
// Transport State Types
// ============================================================================

/**
 * Possible states for an SSE transport connection.
 *
 * State Machine:
 * ```
 * idle ──▶ connecting ──▶ connected ──▶ streaming
 *   ▲          │              │              │
 *   │          ▼              ▼              ▼
 *   └─────── error ◀──────────┴──────────────┘
 *                                    │
 *                                    ▼
 *                                 closed
 * ```
 */
export type SseTransportState = 'idle' | 'connecting' | 'connected' | 'streaming' | 'error' | 'closed';

/**
 * All possible SSE transport states as a readonly array.
 */
export const SSE_TRANSPORT_STATES = ['idle', 'connecting', 'connected', 'streaming', 'error', 'closed'] as const;

/**
 * Listener function signature for SSE transport state changes.
 */
export type SseTransportStateListener = (
  state: SseTransportState,
  transport: SseTransport | null,
  error?: Error,
) => void;

/**
 * Event object representing an SSE transport state transition.
 */
export interface SseTransportStateEvent {
  /** The previous transport state */
  readonly previousState: SseTransportState;
  /** The new (current) transport state */
  readonly currentState: SseTransportState;
  /** Session ID of the transport */
  readonly sessionId: string;
  /** Error that caused the transition (if applicable) */
  readonly error?: Error;
  /** Timestamp when the transition occurred */
  readonly timestamp: Date;
}

// ============================================================================
// Connection Metrics Types
// ============================================================================

/**
 * Metrics for SSE transport connections.
 */
export interface SseConnectionMetrics {
  /** Total number of SSE connections established */
  readonly totalConnections: number;
  /** Currently active SSE connections */
  readonly activeConnections: number;
  /** Number of connection errors */
  readonly errorCount: number;
  /** Average connection duration in milliseconds */
  readonly averageConnectionDurationMs: number;
  /** Total messages sent via SSE */
  readonly messagesSent: number;
  /** Total bytes sent via SSE */
  readonly bytesSent: number;
}

/**
 * Connection health status for SSE transport.
 */
export interface SseConnectionHealth {
  /** Whether the connection is healthy */
  readonly isHealthy: boolean;
  /** Time since last activity in milliseconds */
  readonly idleTimeMs: number;
  /** Whether the SSE stream is writable */
  readonly isWritable: boolean;
  /** Last error if any */
  readonly lastError?: Error;
}

// ============================================================================
// Reconnection Types
// ============================================================================

/**
 * Configuration for SSE reconnection behavior.
 */
export interface SseReconnectionConfig {
  /** Whether automatic reconnection is enabled */
  readonly enabled: boolean;
  /** Initial delay before first reconnection attempt (ms) */
  readonly initialDelayMs: number;
  /** Maximum delay between reconnection attempts (ms) */
  readonly maxDelayMs: number;
  /** Multiplier for exponential backoff */
  readonly backoffMultiplier: number;
  /** Maximum number of reconnection attempts (0 = infinite) */
  readonly maxAttempts: number;
}

/**
 * State of an ongoing reconnection attempt.
 */
export interface SseReconnectionState {
  /** Current attempt number */
  readonly attempt: number;
  /** Time until next reconnection attempt (ms) */
  readonly nextAttemptMs: number;
  /** Whether reconnection is in progress */
  readonly isReconnecting: boolean;
  /** Last reconnection error if any */
  readonly lastError?: Error;
}
