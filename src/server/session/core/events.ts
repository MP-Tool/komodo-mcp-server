/**
 * Session Events Module
 *
 * Provides event-based observability for session lifecycle.
 * Uses Node.js EventEmitter pattern for loose coupling.
 *
 * ## Features
 * - Type-safe event emission and handling
 * - Session lifecycle event tracking
 * - Debugging and monitoring support
 * - OpenTelemetry integration ready
 *
 * @module session/core/events
 */

import { EventEmitter } from 'events';
import type { SessionEventType, SessionEvent, SessionStats } from './types.js';

// ============================================================================
// Event Types
// ============================================================================

/**
 * Extended session event with additional metadata.
 */
export interface SessionLifecycleEvent extends SessionEvent {
  /** Manager instance ID for multi-instance scenarios */
  managerId?: string;

  /** Session statistics at event time */
  stats?: SessionStats;

  /** Duration in ms (for expired/closed events) */
  durationMs?: number;

  /** Reason for event (for removed/closed events) */
  reason?: SessionCloseReason;
}

/**
 * Reasons why a session might be closed.
 */
export type SessionCloseReason =
  | 'timeout'
  | 'heartbeat_failure'
  | 'client_disconnect'
  | 'server_shutdown'
  | 'manual_removal'
  | 'error';

/**
 * Session metrics snapshot for events.
 *
 * This interface provides a summary view of session metrics
 * suitable for event payloads and external consumers.
 */
export interface SessionMetricsSnapshot {
  /** Total sessions created since start */
  totalCreated: number;

  /** Total sessions expired since start */
  totalExpired: number;

  /** Total sessions removed manually */
  totalRemoved: number;

  /** Total heartbeat failures */
  totalHeartbeatFailures: number;

  /** Current active session count */
  activeCount: number;

  /** Peak concurrent sessions */
  peakConcurrentSessions: number;
}

// ============================================================================
// Event Emitter
// ============================================================================

/**
 * Typed event map for session events.
 */
export interface SessionEventMap {
  /** Emitted when a session is created */
  'session:created': [SessionLifecycleEvent];

  /** Emitted when a session is accessed */
  'session:accessed': [SessionLifecycleEvent];

  /** Emitted when a session is touched (activity update) */
  'session:touched': [SessionLifecycleEvent];

  /** Emitted when a session expires due to timeout */
  'session:expired': [SessionLifecycleEvent];

  /** Emitted when a session is removed */
  'session:removed': [SessionLifecycleEvent];

  /** Emitted when a heartbeat is sent successfully */
  'session:heartbeat_sent': [SessionLifecycleEvent];

  /** Emitted when a heartbeat fails */
  'session:heartbeat_failed': [SessionLifecycleEvent];

  /** Emitted when a session is closed */
  'session:closed': [SessionLifecycleEvent];

  /** Emitted when session limit is reached */
  'session:limit_reached': [SessionLifecycleEvent];

  /** Emitted periodically with metrics */
  'session:metrics': [SessionMetricsSnapshot];
}

/**
 * Default maximum number of listeners per event.
 * Prevents memory leaks from unbounded listener registration.
 */
export const DEFAULT_MAX_LISTENERS = 20;

/**
 * Type-safe session event emitter.
 *
 * Extends EventEmitter with proper TypeScript typing for session events.
 *
 * @example
 * ```typescript
 * const emitter = new SessionEventEmitter();
 *
 * emitter.on('session:created', (event) => {
 *   console.log(`Session created: ${event.sessionId}`);
 * });
 *
 * emitter.emitSessionEvent('created', 'session-123', { stats });
 * ```
 */
export class SessionEventEmitter extends EventEmitter {
  constructor(maxListeners: number = DEFAULT_MAX_LISTENERS) {
    super();
    this.setMaxListeners(maxListeners);
  }
  /**
   * Emits a typed session event.
   *
   * @param type - The event type
   * @param sessionId - The session identifier
   * @param details - Additional event details
   * @returns true if listeners were called
   */
  emitSessionEvent(
    type: SessionEventType,
    sessionId: string,
    details?: Partial<Omit<SessionLifecycleEvent, 'type' | 'sessionId' | 'timestamp'>>,
  ): boolean {
    const event: SessionLifecycleEvent = {
      type,
      sessionId,
      timestamp: new Date(),
      ...details,
    };

    return this.emit(`session:${type}`, event);
  }

  /**
   * Emits a limit reached event.
   *
   * @param maxCount - The maximum session count
   * @param stats - Current session stats
   * @returns true if listeners were called
   */
  emitLimitReached(maxCount: number, stats?: SessionStats): boolean {
    const event: SessionLifecycleEvent = {
      type: 'limit_reached',
      sessionId: '<limit>', // Sentinel value for limit events
      timestamp: new Date(),
      stats,
      details: { maxCount, reason: 'Session limit reached' },
    };

    return this.emit('session:limit_reached', event);
  }

  /**
   * Emits metrics snapshot.
   *
   * @param metrics - Current metrics snapshot
   * @returns true if listeners were called
   */
  emitMetrics(metrics: SessionMetricsSnapshot): boolean {
    return this.emit('session:metrics', metrics);
  }

  /**
   * Adds a typed listener for session events.
   *
   * @param event - Event name
   * @param listener - Event handler
   */
  onSessionEvent<K extends keyof SessionEventMap>(event: K, listener: (...args: SessionEventMap[K]) => void): this {
    return this.on(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Adds a one-time typed listener for session events.
   *
   * @param event - Event name
   * @param listener - Event handler
   */
  onceSessionEvent<K extends keyof SessionEventMap>(event: K, listener: (...args: SessionEventMap[K]) => void): this {
    return this.once(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Removes a typed listener for session events.
   *
   * @param event - Event name
   * @param listener - Event handler to remove
   */
  offSessionEvent<K extends keyof SessionEventMap>(event: K, listener: (...args: SessionEventMap[K]) => void): this {
    return this.off(event, listener as (...args: unknown[]) => void);
  }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

/** Global session event emitter instance */
let globalEmitter: SessionEventEmitter | null = null;

/**
 * Gets the global session event emitter.
 *
 * Creates a singleton instance on first call.
 *
 * @returns The global SessionEventEmitter instance
 */
export function getSessionEventEmitter(): SessionEventEmitter {
  if (!globalEmitter) {
    globalEmitter = new SessionEventEmitter();
  }
  return globalEmitter;
}

/**
 * Creates a new session event emitter.
 *
 * Use this for isolated instances (e.g., testing).
 *
 * @returns A new SessionEventEmitter instance
 */
export function createSessionEventEmitter(): SessionEventEmitter {
  return new SessionEventEmitter();
}

/**
 * Resets the global event emitter.
 *
 * Useful for testing to ensure clean state.
 */
export function resetSessionEventEmitter(): void {
  if (globalEmitter) {
    globalEmitter.removeAllListeners();
    globalEmitter = null;
  }
}
