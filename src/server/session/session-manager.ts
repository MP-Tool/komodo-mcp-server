/**
 * Transport Session Manager
 *
 * Main class for managing MCP transport sessions.
 * Uses modular components for lifecycle, cleanup, and heartbeat operations.
 *
 * ## Features
 * - Session lifecycle management (add, get, remove)
 * - Activity tracking for each session
 * - Automatic expiration of idle sessions
 * - Keep-alive heartbeats for active connections
 * - Graceful shutdown with transport cleanup
 * - Session statistics and monitoring
 *
 * ## Usage
 *
 * ```typescript
 * import { TransportSessionManager } from './session/index.js';
 *
 * const manager = new TransportSessionManager();
 *
 * // Add a session
 * manager.add(sessionId, transport);
 *
 * // Get a session (updates activity)
 * const transport = manager.get(sessionId);
 *
 * // Check capacity
 * if (manager.hasCapacity()) {
 *   manager.add(newSessionId, newTransport);
 * }
 *
 * // Get statistics
 * console.log(manager.getStatsString());
 *
 * // Remove a session
 * manager.remove(sessionId);
 *
 * // Shutdown
 * await manager.closeAll();
 * ```
 *
 * @module session/session-manager
 */

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  SESSION_TIMEOUT_MS,
  SESSION_CLEANUP_INTERVAL_MS,
  SESSION_KEEP_ALIVE_INTERVAL_MS,
  SESSION_MAX_MISSED_HEARTBEATS,
  SESSION_MAX_COUNT,
} from '../../config/index.js';
import { logger as baseLogger } from '../../utils/index.js';

// Import all session core types and utilities from barrel file
import type {
  SessionData,
  ISessionManager,
  SessionConfig,
  SessionStats,
  SessionMetricsCollector,
} from './core/index.js';
import {
  SESSION_LOG_COMPONENT,
  SessionLogMessages,
  // Events
  SessionEventEmitter,
  createSessionEventEmitter,
  type SessionCloseReason,
  // Metrics
  createSessionMetrics,
  // Errors
  SessionInvalidError,
  // Schemas
  validateSessionConfigSafe,
  formatValidationErrors,
} from './core/index.js';

// Import operations from barrel file
import {
  addSession,
  getSession,
  touchSession,
  hasSession,
  removeSession,
  closeAllSessions,
  cleanupExpiredSessions,
  sendKeepAlives,
  type CleanupResult,
  type HeartbeatResult,
} from './operations/index.js';

// Import utils from barrel file
import {
  getSessionStats,
  formatSessionStats,
  canAddSession,
  getRemainingCapacity,
  isValidSessionId,
} from './utils/index.js';

const logger = baseLogger.child({ component: SESSION_LOG_COMPONENT });

// ============================================================================
// Session Manager Class
// ============================================================================

/**
 * Manages MCP transport sessions with automatic expiration and keep-alive.
 *
 * Implements the ISessionManager interface for consistent session management.
 *
 * @example
 * ```typescript
 * // Create with default config
 * const manager = new TransportSessionManager();
 *
 * // Create with custom config
 * const manager = new TransportSessionManager({
 *   timeoutMs: 15 * 60 * 1000, // 15 minutes
 *   maxCount: 50,
 * });
 *
 * // Listen to session events
 * manager.events.on('session:created', (event) => {
 *   console.log(`Session created: ${event.sessionId}`);
 * });
 * ```
 */
export class TransportSessionManager implements ISessionManager {
  /** Internal sessions storage */
  private readonly sessions = new Map<string, SessionData>();

  /** Cleanup interval timer */
  private cleanupInterval: NodeJS.Timeout | null = null;

  /** Keep-alive interval timer */
  private keepAliveInterval: NodeJS.Timeout | null = null;

  /** Session configuration */
  private readonly config: SessionConfig;

  /** Whether the manager has been shut down */
  private isShutdown = false;

  /** Event emitter for session lifecycle events */
  private readonly eventEmitter: SessionEventEmitter;

  /** Metrics collector for session statistics */
  private readonly metricsCollector: SessionMetricsCollector;

  /**
   * Creates a new TransportSessionManager.
   *
   * @param config - Optional configuration override (uses env defaults if not provided)
   * @throws SessionInvalidError if configuration is invalid
   */
  constructor(config?: Partial<SessionConfig>) {
    // Validate configuration using Zod schema if provided
    if (config) {
      const validation = validateSessionConfigSafe(config);
      if (!validation.success) {
        throw new SessionInvalidError(`Invalid session config: ${formatValidationErrors(validation.errors)}`, {
          context: { providedConfig: config, errors: validation.errors },
          recoveryHint: 'Check the session configuration values and ensure they are within valid ranges.',
        });
      }
    }

    // Initialize observability components (factory pattern for isolation)
    this.eventEmitter = createSessionEventEmitter();
    this.metricsCollector = createSessionMetrics();

    // Merge config with defaults from environment
    this.config = {
      timeoutMs: config?.timeoutMs ?? SESSION_TIMEOUT_MS,
      cleanupIntervalMs: config?.cleanupIntervalMs ?? SESSION_CLEANUP_INTERVAL_MS,
      keepAliveIntervalMs: config?.keepAliveIntervalMs ?? SESSION_KEEP_ALIVE_INTERVAL_MS,
      maxMissedHeartbeats: config?.maxMissedHeartbeats ?? SESSION_MAX_MISSED_HEARTBEATS,
      maxCount: config?.maxCount ?? SESSION_MAX_COUNT,
    };

    // Start background tasks
    this.startBackgroundTasks();

    logger.debug(
      SessionLogMessages.MANAGER_STARTED,
      this.config.timeoutMs / 60000,
      this.config.cleanupIntervalMs / 1000,
      this.config.keepAliveIntervalMs / 1000,
    );
  }

  // ==========================================================================
  // ISessionManager Implementation
  // ==========================================================================

  /**
   * Adds a transport to the session map with current timestamp.
   * Returns false if max session limit reached or manager is shut down.
   *
   * @param sessionId - Unique session identifier
   * @param transport - MCP transport instance
   * @returns true if added successfully, false if limit reached or shut down
   * @throws SessionInvalidError if session ID format is invalid
   */
  add(sessionId: string, transport: Transport): boolean {
    // Validate session ID format
    if (!isValidSessionId(sessionId)) {
      throw new SessionInvalidError('Invalid session ID format', {
        sessionId,
        recoveryHint: 'Session IDs must be non-empty strings between 1 and 256 characters.',
      });
    }

    if (this.isShutdown) {
      logger.warn('Cannot add session: manager is shut down');
      return false;
    }

    // Check limit before adding
    if (this.sessions.size >= this.config.maxCount) {
      this.metricsCollector.recordLimitReached();
      this.eventEmitter.emitLimitReached(this.config.maxCount, this.getStats());
      logger.warn(`Session limit reached: ${this.sessions.size}/${this.config.maxCount}`, {
        sessionId,
        maxCount: this.config.maxCount,
      });
      return false;
    }

    const added = addSession(this.sessions, sessionId, transport, this.config.maxCount);

    if (added) {
      // Record metrics
      this.metricsCollector.recordSessionCreated();

      // Emit event
      this.eventEmitter.emitSessionEvent('created', sessionId, {
        stats: this.getStats(),
      });
    }

    return added;
  }

  /**
   * Gets a transport by session ID and updates activity time.
   *
   * @param sessionId - Session identifier to look up
   * @returns The transport if found, undefined otherwise
   */
  get(sessionId: string): Transport | undefined {
    const transport = getSession(this.sessions, sessionId);

    if (transport) {
      // Emit accessed event (optional, can be noisy)
      // this.eventEmitter.emitSessionEvent('accessed', sessionId);
    }

    return transport;
  }

  /**
   * Updates the last activity time for a session.
   *
   * @param sessionId - Session identifier to touch
   */
  touch(sessionId: string): void {
    touchSession(this.sessions, sessionId);
    this.eventEmitter.emitSessionEvent('touched', sessionId);
  }

  /**
   * Checks if a session exists.
   *
   * @param sessionId - Session identifier to check
   * @returns true if session exists
   */
  has(sessionId: string): boolean {
    return hasSession(this.sessions, sessionId);
  }

  /**
   * Removes a transport from the sessions map.
   *
   * @param sessionId - Session identifier to remove
   * @returns true if removed, false if not found
   */
  remove(sessionId: string): boolean {
    // Calculate duration before removal
    const durationMs = this.getSessionDuration(sessionId);
    const closeReason: SessionCloseReason = 'manual_removal';

    const removed = removeSession(this.sessions, sessionId);

    if (removed) {
      // Record metrics
      this.metricsCollector.recordSessionClosed(closeReason, durationMs);
      this.metricsCollector.recordSessionRemoved();

      // Emit event
      this.eventEmitter.emitSessionEvent('removed', sessionId, {
        durationMs,
        reason: closeReason,
      });
    }

    return removed;
  }

  /**
   * Closes all active transports gracefully.
   */
  async closeAll(): Promise<void> {
    this.isShutdown = true;
    const closeReason: SessionCloseReason = 'server_shutdown';

    // Emit closed events for all sessions
    for (const sessionId of this.sessions.keys()) {
      const durationMs = this.getSessionDuration(sessionId);
      this.metricsCollector.recordSessionClosed(closeReason, durationMs);
      this.eventEmitter.emitSessionEvent('closed', sessionId, {
        durationMs,
        reason: closeReason,
      });
    }

    // Stop intervals first
    this.stopBackgroundTasks();

    // Close all sessions
    await closeAllSessions(this.sessions);
  }

  /**
   * Returns the number of active sessions.
   */
  get size(): number {
    return this.sessions.size;
  }

  // ==========================================================================
  // Observability API
  // ==========================================================================

  /**
   * Gets the event emitter for session lifecycle events.
   *
   * Use this to subscribe to session events:
   * - `session:created` - When a session is created
   * - `session:expired` - When a session times out
   * - `session:removed` - When a session is manually removed
   * - `session:closed` - When a session is closed
   * - `session:heartbeat_sent` - When a heartbeat succeeds
   * - `session:heartbeat_failed` - When a heartbeat fails
   * - `session:limit_reached` - When session limit is reached
   *
   * @returns The SessionEventEmitter instance
   *
   * @example
   * ```typescript
   * manager.events.on('session:created', (event) => {
   *   console.log(`Session ${event.sessionId} created`);
   * });
   * ```
   */
  get events(): SessionEventEmitter {
    return this.eventEmitter;
  }

  /**
   * Gets the metrics collector for session statistics.
   *
   * @returns The SessionMetricsCollector instance
   */
  get metrics(): SessionMetricsCollector {
    return this.metricsCollector;
  }

  /**
   * Gets a snapshot of session metrics.
   *
   * @returns Current metrics snapshot
   */
  getMetricsSnapshot() {
    return this.metricsCollector.getMetricsSnapshot();
  }

  // ==========================================================================
  // Extended Public API
  // ==========================================================================

  /**
   * Gets the current session configuration.
   *
   * @returns Readonly copy of the configuration
   */
  getConfig(): Readonly<SessionConfig> {
    return { ...this.config };
  }

  /**
   * Gets session statistics for monitoring.
   *
   * @returns Current session statistics
   */
  getStats(): SessionStats {
    return getSessionStats(this.sessions, this.config.maxCount);
  }

  /**
   * Gets a formatted stats string for logging.
   *
   * @returns Formatted stats string (e.g., "5/100 sessions active")
   */
  getStatsString(): string {
    return formatSessionStats(this.getStats());
  }

  /**
   * Checks if more sessions can be added.
   *
   * @returns true if capacity is available
   */
  hasCapacity(): boolean {
    return canAddSession(this.sessions.size, this.config.maxCount);
  }

  /**
   * Gets the remaining session capacity.
   *
   * @returns Number of sessions that can still be added
   */
  getRemainingCapacity(): number {
    return getRemainingCapacity(this.sessions.size, this.config.maxCount);
  }

  /**
   * Checks if the manager has been shut down.
   *
   * @returns true if closeAll() has been called
   */
  isShutDown(): boolean {
    return this.isShutdown;
  }

  /**
   * Manually triggers a cleanup cycle.
   * Useful for testing or forced cleanup.
   *
   * @returns Cleanup result with counts and session IDs
   */
  runCleanup(): CleanupResult {
    // Skip cleanup if manager is shutting down
    if (this.isShutdown) {
      return {
        removedCount: 0,
        extendedCount: 0,
        remainingCount: this.sessions.size,
        removedSessions: [],
        extendedSessions: [],
      };
    }

    const result = cleanupExpiredSessions(this.sessions, this.config.timeoutMs);
    const closeReason: SessionCloseReason = 'timeout';

    // Record metrics
    this.metricsCollector.recordCleanupCycle(result.removedCount, result.extendedCount);

    // Emit events for expired sessions
    for (const { sessionId, idleTimeMs, durationMs } of result.removedSessions) {
      // Record metrics (durationMs is pre-calculated before session deletion)
      this.metricsCollector.recordSessionExpired(durationMs);

      // Emit expired event
      this.eventEmitter.emitSessionEvent('expired', sessionId, {
        durationMs,
        reason: closeReason,
        details: { idleTimeMs },
      });
    }

    // Emit events for extended sessions
    for (const { sessionId } of result.extendedSessions) {
      this.eventEmitter.emitSessionEvent('heartbeat_sent', sessionId);
    }

    return result;
  }

  /**
   * Manually triggers a keep-alive cycle.
   * Useful for testing or forced heartbeat.
   *
   * @returns Heartbeat result with counts and removed session IDs
   */
  runKeepAlive(): HeartbeatResult {
    // Skip keep-alive if manager is shutting down
    if (this.isShutdown) {
      return {
        successCount: 0,
        failedCount: 0,
        removedCount: 0,
        removedSessions: [],
      };
    }

    const result = sendKeepAlives(this.sessions, this.config.maxMissedHeartbeats);
    const closeReason: SessionCloseReason = 'heartbeat_failure';

    // Record metrics for heartbeats (batch)
    this.metricsCollector.recordHeartbeatSuccesses(result.successCount);
    this.metricsCollector.recordHeartbeatFailures(result.failedCount);

    // Emit events for dead sessions that were removed
    for (const { sessionId, missedHeartbeats } of result.removedSessions) {
      const durationMs = this.getSessionDuration(sessionId);

      // Record metrics
      this.metricsCollector.recordSessionClosed(closeReason, durationMs);

      // Emit heartbeat_failed event
      this.eventEmitter.emitSessionEvent('heartbeat_failed', sessionId, {
        durationMs,
        reason: closeReason,
        details: { missedHeartbeats },
      });
    }

    return result;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Calculates the duration of a session in milliseconds.
   *
   * @param sessionId - The session ID
   * @returns Duration in ms, or 0 if session not found
   */
  private getSessionDuration(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return 0;
    }
    return Date.now() - session.createdAt.getTime();
  }

  /**
   * Starts all background tasks.
   */
  private startBackgroundTasks(): void {
    // Start background cleanup task for expired sessions
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, this.config.cleanupIntervalMs);

    // Start background keep-alive task
    this.keepAliveInterval = setInterval(() => {
      this.runKeepAlive();
    }, this.config.keepAliveIntervalMs);
  }

  /**
   * Stops all background tasks.
   */
  private stopBackgroundTasks(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}
