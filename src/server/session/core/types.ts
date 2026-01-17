/**
 * Session Core Types Module
 *
 * Defines the fundamental types and interfaces for the session management system.
 * These types are used throughout all session components.
 *
 * @module session/core/types
 */

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

// ============================================================================
// Transport Types
// ============================================================================

/**
 * Interface for transports that support heartbeat functionality.
 *
 * Some transports (like StreamableHTTPServerTransport) have sendHeartbeat
 * but it's not in the public SDK types. This interface extends Transport
 * to include optional heartbeat capability.
 *
 * @example
 * ```typescript
 * const transport = session.transport as HeartbeatCapableTransport;
 * if (transport.sendHeartbeat) {
 *   const isAlive = transport.sendHeartbeat();
 * }
 * ```
 */
export interface HeartbeatCapableTransport extends Transport {
  /**
   * Sends a heartbeat to check if the connection is still alive.
   * @returns true if heartbeat was sent successfully, false otherwise
   */
  sendHeartbeat?: () => boolean;
}

// ============================================================================
// Session Data Types
// ============================================================================

/**
 * Session data with activity tracking for expiration.
 *
 * Each session tracks:
 * - The transport instance for communication
 * - Creation timestamp for duration calculation
 * - Last activity timestamp for timeout calculation
 * - Missed heartbeat count for dead connection detection
 */
export interface SessionData {
  /** The MCP transport instance for this session */
  transport: Transport;

  /** Timestamp when the session was created */
  createdAt: Date;

  /** Timestamp of last activity (request/response) */
  lastActivity: Date;

  /** Number of consecutive missed heartbeats */
  missedHeartbeats: number;
}

/**
 * Session statistics for monitoring and debugging.
 */
export interface SessionStats {
  /** Total number of active sessions */
  activeCount: number;

  /** Maximum allowed sessions */
  maxCount: number;

  /** Session IDs (truncated for display) */
  sessionIds: string[];
}

// ============================================================================
// Session Manager Interface
// ============================================================================

/**
 * Interface for session manager implementations.
 *
 * Defines the contract that all session managers must implement,
 * allowing for different implementations (e.g., in-memory, Redis-backed).
 */
export interface ISessionManager {
  /**
   * Adds a transport to the session map.
   * @param sessionId - Unique session identifier
   * @param transport - MCP transport instance
   * @returns true if added successfully, false if limit reached
   */
  add(sessionId: string, transport: Transport): boolean;

  /**
   * Gets a transport by session ID and updates activity time.
   * @param sessionId - Session identifier to look up
   * @returns The transport if found, undefined otherwise
   */
  get(sessionId: string): Transport | undefined;

  /**
   * Updates the last activity time for a session.
   * @param sessionId - Session identifier to touch
   */
  touch(sessionId: string): void;

  /**
   * Checks if a session exists.
   * @param sessionId - Session identifier to check
   * @returns true if session exists
   */
  has(sessionId: string): boolean;

  /**
   * Removes a transport from the session map.
   * @param sessionId - Session identifier to remove
   * @returns true if removed, false if not found
   */
  remove(sessionId: string): boolean;

  /**
   * Closes all active transports gracefully.
   */
  closeAll(): Promise<void>;

  /**
   * Returns the number of active sessions.
   */
  readonly size: number;
}

// ============================================================================
// Session Configuration Types
// ============================================================================

/**
 * Configuration options for session management.
 */
export interface SessionConfig {
  /** Session timeout in milliseconds */
  timeoutMs: number;

  /** Cleanup interval in milliseconds */
  cleanupIntervalMs: number;

  /** Keep-alive interval in milliseconds */
  keepAliveIntervalMs: number;

  /** Maximum missed heartbeats before session is closed */
  maxMissedHeartbeats: number;

  /** Maximum number of concurrent sessions */
  maxCount: number;
}

/**
 * Session event types for lifecycle tracking.
 */
export type SessionEventType =
  | 'created'
  | 'accessed'
  | 'touched'
  | 'expired'
  | 'removed'
  | 'heartbeat_sent'
  | 'heartbeat_failed'
  | 'closed'
  | 'limit_reached';

/**
 * Session event for lifecycle tracking and logging.
 */
export interface SessionEvent {
  /** Type of session event */
  type: SessionEventType;

  /** Session identifier */
  sessionId: string;

  /** Event timestamp */
  timestamp: Date;

  /** Additional event details */
  details?: Record<string, unknown>;
}
