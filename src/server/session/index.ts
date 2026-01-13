/**
 * Session Module
 *
 * Centralized session management for the Komodo MCP Server.
 *
 * ## Architecture
 *
 * ```
 * session/
 * ├── core/               # Types, constants, interfaces
 * │   ├── types.ts        # Session types & interfaces
 * │   ├── constants.ts    # Configuration constants
 * │   └── index.ts        # Core exports
 * ├── operations/         # Session operations (pure functions)
 * │   ├── lifecycle.ts    # add, get, remove, touch operations
 * │   ├── cleanup.ts      # Expired session cleanup
 * │   ├── heartbeat.ts    # Keep-alive heartbeats
 * │   └── index.ts        # Operations exports
 * ├── utils/              # Session utilities
 * │   ├── format.ts       # Formatting helpers
 * │   ├── validation.ts   # Validation utilities
 * │   └── index.ts        # Utils exports
 * ├── session-manager.ts  # Main TransportSessionManager class
 * └── index.ts            # Module barrel export
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import { TransportSessionManager } from './server/session/index.js';
 *
 * // Create manager (uses env config by default)
 * const sessionManager = new TransportSessionManager();
 *
 * // Add a session
 * const added = sessionManager.add(sessionId, transport);
 *
 * // Get a session (updates activity timestamp)
 * const transport = sessionManager.get(sessionId);
 *
 * // Check capacity before adding
 * if (sessionManager.hasCapacity()) {
 *   sessionManager.add(newSessionId, newTransport);
 * }
 *
 * // Get statistics
 * console.log(sessionManager.getStatsString()); // "5/100 sessions active"
 *
 * // Remove a session
 * sessionManager.remove(sessionId);
 *
 * // Graceful shutdown
 * await sessionManager.closeAll();
 * ```
 *
 * ## Features
 *
 * - **Automatic Expiration**: Sessions expire after configurable timeout
 * - **Keep-Alive Heartbeats**: Prevents proxy/client connection drops
 * - **Dead Connection Detection**: Removes sessions after missed heartbeats
 * - **Session Limits**: Prevents memory exhaustion
 * - **Graceful Shutdown**: Closes all transports properly
 * - **Statistics & Monitoring**: Track active sessions and capacity
 * - **Configuration Validation**: Validates config on creation
 * - **Event-Based Observability**: Session lifecycle events
 * - **OpenTelemetry Metrics**: Integrated metrics collection
 *
 * @module session
 */

// ============================================================================
// Core Types & Constants
// ============================================================================

export type {
  // Transport types
  HeartbeatCapableTransport,
  // Session data types
  SessionData,
  SessionStats,
  // Manager interface
  ISessionManager,
  // Configuration types
  SessionConfig,
  SessionEventType,
  SessionEvent,
  // Event types
  SessionLifecycleEvent,
  SessionCloseReason,
  SessionEventMap,
  // Metrics types
  SessionMetricsCollector,
  SessionMetricsManager,
  SessionMetricsSnapshot,
  DetailedSessionMetrics,
  // Error types
  SessionErrorCode,
  SessionErrorOptions,
  // Schema types
  ValidatedSessionConfig,
  PartialValidatedSessionConfig,
  ValidatedSessionId,
  ValidatedSessionData,
  ValidationErrorDetail,
  ValidationResult,
} from './core/index.js';

export {
  // Timeout configuration
  DEFAULT_SESSION_TIMEOUT_MS,
  DEFAULT_SESSION_CLEANUP_INTERVAL_MS,
  DEFAULT_SESSION_KEEP_ALIVE_INTERVAL_MS,
  DEFAULT_SESSION_MAX_MISSED_HEARTBEATS,
  DEFAULT_SESSION_MAX_COUNT,
  // Session ID configuration
  SESSION_ID_DISPLAY_LENGTH,
  SESSION_ID_PREFIX,
  // Event descriptions
  SESSION_EVENT_DESCRIPTIONS,
  // Logging
  SESSION_LOG_COMPONENT,
  SessionLogMessages,
  // Events
  SessionEventEmitter,
  getSessionEventEmitter,
  createSessionEventEmitter,
  resetSessionEventEmitter,
  // Metrics
  SESSION_METRIC_NAMES,
  SESSION_METRIC_ATTRIBUTES,
  getSessionMetrics,
  createSessionMetrics,
  resetSessionMetrics,
  // Errors
  SessionErrorCodes,
  SessionError,
  SessionLimitError,
  SessionNotFoundError,
  SessionExpiredError,
  SessionInvalidError,
  SessionManagerShutdownError,
  isSessionError,
  isSessionLimitError,
  isSessionNotFoundError,
  isSessionExpiredError,
  isSessionInvalidError,
  isSessionManagerShutdownError,
  // Schemas
  SESSION_CONFIG_LIMITS,
  SESSION_VALIDATION_MESSAGES,
  SessionTimeoutSchema,
  SessionCleanupIntervalSchema,
  SessionKeepAliveIntervalSchema,
  SessionMaxMissedHeartbeatsSchema,
  SessionMaxCountSchema,
  SessionConfigSchema,
  PartialSessionConfigSchema,
  SessionIdSchema,
  SessionDataSchema,
  parseSessionConfig,
  validateSessionConfigSafe,
  parseSessionId,
  validateSessionIdSafe,
  parsePartialSessionConfig,
  validatePartialSessionConfigSafe,
  isValidTimeout,
  isValidCleanupInterval,
  isValidKeepAliveInterval,
  isValidMaxMissedHeartbeats,
  isValidMaxCount,
  formatValidationErrors,
} from './core/index.js';

// ============================================================================
// Session Manager
// ============================================================================

export { TransportSessionManager } from './session-manager.js';

// ============================================================================
// Operations (for testing and advanced usage)
// ============================================================================

export {
  // Lifecycle operations
  createSessionData,
  addSession,
  getSession,
  touchSession,
  hasSession,
  removeSession,
  closeAllSessions,
  // Cleanup operations
  cleanupExpiredSessions,
  getSessionIdleTime,
  isSessionExpired,
  type CleanupResult,
  type CleanedSession,
  type ExtendedSession,
  // Heartbeat operations
  hasHeartbeat,
  sendHeartbeatSafe,
  sendKeepAlives,
  sendHeartbeat,
  isSessionDead,
  type HeartbeatResult,
} from './operations/index.js';

// ============================================================================
// Utilities
// ============================================================================

export {
  // Formatting
  formatSessionId,
  formatSessionIdFull,
  formatDuration,
  formatIdleTime,
  getSessionStats,
  formatSessionStats,
  formatSessionList,
  // Validation
  isValidSessionId,
  validateSessionId,
  type SessionIdValidationResult,
  isSessionHealthy,
  canAddSession,
  getRemainingCapacity,
} from './utils/index.js';
