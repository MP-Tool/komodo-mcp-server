/**
 * Session Core Constants Module
 *
 * Centralized constants for the session management system.
 * All session-related constants should be defined here for consistency
 * and to avoid magic values scattered throughout the codebase.
 *
 * @module session/core/constants
 */

import type { SessionEventType } from './types.js';

// ============================================================================
// Session Timeout Configuration
// ============================================================================

/**
 * Default session timeout in milliseconds.
 * Sessions inactive for this duration will be cleaned up.
 *
 * Default: 30 minutes
 */
export const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Default cleanup interval in milliseconds.
 * How often to check for expired sessions.
 *
 * Default: 5 minutes
 */
export const DEFAULT_SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Default keep-alive interval in milliseconds.
 * How often to send heartbeats to active sessions.
 *
 * Default: 30 seconds
 */
export const DEFAULT_SESSION_KEEP_ALIVE_INTERVAL_MS = 30 * 1000;

/**
 * Default maximum missed heartbeats before session is closed.
 * After this many consecutive failed heartbeats, the session is considered dead.
 *
 * Default: 3
 */
export const DEFAULT_SESSION_MAX_MISSED_HEARTBEATS = 3;

/**
 * Default maximum number of concurrent sessions.
 * Prevents memory exhaustion from too many sessions.
 *
 * Default: 100
 */
export const DEFAULT_SESSION_MAX_COUNT = 100;

// ============================================================================
// Session ID Configuration
// ============================================================================

/**
 * Number of characters to display from session ID in logs.
 * Full session IDs are long UUIDs, so we truncate for readability.
 */
export const SESSION_ID_DISPLAY_LENGTH = 8;

/**
 * Session ID prefix for generated IDs.
 */
export const SESSION_ID_PREFIX = 'sess_';

// ============================================================================
// Event Type Descriptions
// ============================================================================

/**
 * Human-readable descriptions for session event types.
 */
export const SESSION_EVENT_DESCRIPTIONS: Readonly<Record<SessionEventType, string>> = {
  created: 'Session created',
  accessed: 'Session accessed (get)',
  touched: 'Session touched (activity updated)',
  expired: 'Session expired (timeout)',
  removed: 'Session removed',
  heartbeat_sent: 'Heartbeat sent successfully',
  heartbeat_failed: 'Heartbeat failed',
  closed: 'Session closed',
  limit_reached: 'Session limit reached',
} as const;

// ============================================================================
// Logging Configuration
// ============================================================================

/**
 * Component name for session-related logs.
 */
export const SESSION_LOG_COMPONENT = 'session';

/**
 * Log messages for session events.
 */
export const SessionLogMessages = {
  // Lifecycle messages
  MANAGER_STARTED: 'SessionManager started (timeout=%dm, cleanup=%ds, keepalive=%ds)',
  SESSION_ADDED: 'Session [%s] added (total=%d)',
  SESSION_REMOVED: 'Session [%s] removed (remaining=%d)',
  SESSION_NOT_FOUND: 'Session [%s] not found',
  SESSION_LIMIT_REACHED: 'Session limit reached (%d), rejecting new session',

  // Cleanup messages
  SESSION_TIMED_OUT: 'Session %s timed out (inactive for %ds)',
  CLEANUP_COMPLETED: 'Cleaned up %d expired sessions (remaining: %d)',

  // Heartbeat messages
  HEARTBEAT_EXTENDED: 'Session %s extended via heartbeat',
  DEAD_SESSION_CLOSED: 'Closing dead session %s after %d failed heartbeats',

  // Shutdown messages
  CLOSING_SESSIONS: 'Closing %d sessions...',
  ALL_SESSIONS_CLOSED: 'All sessions closed',
  CLOSE_ERROR: 'Failed to close session [%s]: %s',
} as const;
