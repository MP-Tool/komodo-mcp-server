/**
 * Session Core Module
 *
 * Re-exports all core session system components:
 * - Types and interfaces
 * - Constants and configuration
 * - Schemas for validation
 * - Events for observability
 * - Metrics for monitoring
 * - Base error class
 * - Specialized error classes
 *
 * @module session/core
 */

// ─────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────
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
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────
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
} from './constants.js';

// ─────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────
export type { SessionLifecycleEvent, SessionCloseReason, SessionMetricsSnapshot, SessionEventMap } from './events.js';

export {
  SessionEventEmitter,
  getSessionEventEmitter,
  createSessionEventEmitter,
  resetSessionEventEmitter,
  DEFAULT_MAX_LISTENERS,
} from './events.js';

// ─────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────
export type { SessionMetricsCollector, SessionMetricsManager, DetailedSessionMetrics } from './metrics.js';

export {
  SESSION_METRIC_NAMES,
  SESSION_METRIC_ATTRIBUTES,
  getSessionMetrics,
  createSessionMetrics,
  resetSessionMetrics,
} from './metrics.js';

// ─────────────────────────────────────────────────────────────────────────
// Base Error Class
// ─────────────────────────────────────────────────────────────────────────
export type { SessionErrorCode, SessionErrorOptions } from './base.js';

export { SessionError, SessionErrorCodes, getMcpCodeForSessionError, getHttpStatusForSessionError } from './base.js';

// ─────────────────────────────────────────────────────────────────────────
// Specialized Error Classes
// ─────────────────────────────────────────────────────────────────────────
export {
  SessionLimitError,
  SessionNotFoundError,
  SessionExpiredError,
  SessionInvalidError,
  SessionManagerShutdownError,
  // Type guards
  isSessionError,
  isSessionLimitError,
  isSessionNotFoundError,
  isSessionExpiredError,
  isSessionInvalidError,
  isSessionManagerShutdownError,
} from './errors.js';

// ─────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────
export type {
  ValidatedSessionConfig,
  PartialValidatedSessionConfig,
  ValidatedSessionId,
  ValidatedSessionData,
  ValidationErrorDetail,
  ValidationResult,
} from './schemas.js';

export {
  // Limits
  SESSION_CONFIG_LIMITS,
  SESSION_VALIDATION_MESSAGES,
  // Schemas
  SessionTimeoutSchema,
  SessionCleanupIntervalSchema,
  SessionKeepAliveIntervalSchema,
  SessionMaxMissedHeartbeatsSchema,
  SessionMaxCountSchema,
  SessionConfigSchema,
  PartialSessionConfigSchema,
  SessionIdSchema,
  SessionDataSchema,
  // Parsing functions
  parseSessionConfig,
  validateSessionConfigSafe,
  parseSessionId,
  validateSessionIdSafe,
  parsePartialSessionConfig,
  validatePartialSessionConfigSafe,
  // Validation helpers
  isValidTimeout,
  isValidCleanupInterval,
  isValidKeepAliveInterval,
  isValidMaxMissedHeartbeats,
  isValidMaxCount,
  isValidSessionId,
  formatValidationErrors,
} from './schemas.js';
