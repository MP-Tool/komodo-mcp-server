/**
 * Connection Module Types
 *
 * Centralized type definitions for the API connection module.
 * Includes connection state management and request tracking types.
 * Generic types work with any API client implementing IApiClient.
 *
 * @module server/connection/core/types
 */

import type { IApiClient } from '../../types/index.js';

// ============================================================================
// Connection State Types
// ============================================================================

/**
 * Possible connection states for the API client.
 *
 * State Machine:
 * ```
 * disconnected ──▶ connecting ──▶ connected
 *      ▲                │              │
 *      │                ▼              │
 *      └──────────── error ◀──────────┘
 * ```
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * All possible connection states as a readonly array.
 * Useful for validation and iteration.
 */
export const CONNECTION_STATES = ['disconnected', 'connecting', 'connected', 'error'] as const;

/**
 * Listener function signature for connection state changes.
 *
 * @typeParam TClient - The API client type (must implement IApiClient)
 * @param state - The new connection state
 * @param client - The API client (null if not connected)
 * @param error - Error object if state is 'error'
 */
export type ConnectionStateListener<TClient extends IApiClient = IApiClient> = (
  state: ConnectionState,
  client: TClient | null,
  error?: Error,
) => void;

/**
 * Event object representing a connection state transition.
 * Used for history tracking and debugging.
 *
 * @typeParam TClient - The API client type (must implement IApiClient)
 */
export interface ConnectionStateEvent<TClient extends IApiClient = IApiClient> {
  /** The previous connection state */
  readonly previousState: ConnectionState;
  /** The new (current) connection state */
  readonly currentState: ConnectionState;
  /** The API client at the time of transition */
  readonly client: TClient | null;
  /** Error that caused the transition (if applicable) */
  readonly error?: Error;
  /** Timestamp when the transition occurred */
  readonly timestamp: Date;
}

/**
 * Statistics about the connection state manager.
 */
export interface ConnectionStateStats {
  /** Current connection state */
  readonly state: ConnectionState;
  /** Whether currently connected */
  readonly isConnected: boolean;
  /** Number of registered listeners */
  readonly listenerCount: number;
  /** Number of state transitions in history */
  readonly historyLength: number;
  /** Last error if any */
  readonly lastError: Error | null;
}

// ============================================================================
// Request Manager Types
// ============================================================================

/**
 * Request ID type - can be string or number per MCP spec.
 */
export type RequestId = string | number;

/**
 * Progress token type for MCP progress notifications.
 */
export type ProgressToken = string | number;

/**
 * Tracks an active MCP request with its abort controller and metadata.
 */
export interface ActiveRequest {
  /** Unique request identifier */
  readonly requestId: RequestId;
  /** MCP method being called (e.g., 'tools/call') */
  readonly method: string;
  /** AbortController to cancel the request */
  readonly abortController: AbortController;
  /** Optional progress token for progress reporting */
  readonly progressToken?: ProgressToken;
  /** Timestamp when the request was registered */
  readonly startedAt: Date;
}

/**
 * Progress data for MCP progress notifications.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2025-11-25/server/utilities/progress/
 */
export interface ProgressData {
  /**
   * Current progress value.
   * Should be between 0 and total (if total is specified).
   */
  progress: number;
  /**
   * Optional total value for percentage calculation.
   * If omitted, progress is indeterminate.
   */
  total?: number;
  /**
   * Optional human-readable message describing current progress.
   */
  message?: string;
}

/**
 * Progress reporter function type.
 * Returns true if progress was sent successfully, false otherwise.
 */
export type ProgressReporter = (data: ProgressData) => Promise<boolean>;

/**
 * Statistics about the request manager state.
 */
export interface RequestManagerStats {
  /** Number of currently active requests */
  readonly activeRequests: number;
  /** List of active request IDs */
  readonly requestIds: readonly RequestId[];
}

/**
 * MCP notification parameters for progress updates.
 */
export interface ProgressNotificationParams {
  /** Progress token identifying the operation */
  progressToken: ProgressToken;
  /** Current progress value */
  progress: number;
  /** Optional total for percentage calculation */
  total?: number;
  /** Optional progress message */
  message?: string;
}

/**
 * Rate limit entry for tracking progress notification timing.
 */
export interface RateLimitEntry {
  /** Timestamp of last notification */
  lastNotification: number;
}
