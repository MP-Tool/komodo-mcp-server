/**
 * Session Formatting Utilities
 *
 * Provides formatting functions for session-related data.
 * Used for logging, display, and debugging purposes.
 *
 * @module session/utils/format
 */

import type { SessionData, SessionStats } from '../core/index.js';
import { SESSION_ID_DISPLAY_LENGTH, SESSION_ID_PREFIX } from '../core/index.js';

// ============================================================================
// Session ID Formatting
// ============================================================================

/**
 * Formats a session ID for display in logs.
 * Truncates long UUIDs to a readable length.
 *
 * @param sessionId - The full session ID
 * @param length - Number of characters to display (default: SESSION_ID_DISPLAY_LENGTH)
 * @returns Truncated session ID for display
 *
 * @example
 * ```typescript
 * formatSessionId('550e8400-e29b-41d4-a716-446655440000');
 * // Returns: '550e8400'
 * ```
 */
export function formatSessionId(sessionId: string, length: number = SESSION_ID_DISPLAY_LENGTH): string {
  if (!sessionId) {
    return '<none>';
  }

  // Remove prefix if present for consistent display
  const idWithoutPrefix = sessionId.startsWith(SESSION_ID_PREFIX)
    ? sessionId.slice(SESSION_ID_PREFIX.length)
    : sessionId;

  if (idWithoutPrefix.length <= length) {
    return idWithoutPrefix;
  }

  return idWithoutPrefix.substring(0, length);
}

/**
 * Formats a session ID with prefix for display.
 *
 * @param sessionId - The session ID
 * @returns Formatted session ID with prefix indicator
 *
 * @example
 * ```typescript
 * formatSessionIdFull('sess_550e8400-e29b-41d4-a716-446655440000');
 * // Returns: 'sess_550e84...'
 * ```
 */
export function formatSessionIdFull(sessionId: string): string {
  if (!sessionId) {
    return '<none>';
  }

  const hasPrefix = sessionId.startsWith(SESSION_ID_PREFIX);
  const prefix = hasPrefix ? SESSION_ID_PREFIX : '';
  const id = hasPrefix ? sessionId.slice(SESSION_ID_PREFIX.length) : sessionId;

  if (id.length <= SESSION_ID_DISPLAY_LENGTH) {
    return sessionId;
  }

  return `${prefix}${id.substring(0, SESSION_ID_DISPLAY_LENGTH)}...`;
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Formats a duration in milliseconds to a human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @returns Human-readable duration string
 *
 * @example
 * ```typescript
 * formatDuration(1800000); // Returns: '30m'
 * formatDuration(3600000); // Returns: '1h'
 * formatDuration(90000);   // Returns: '1m 30s'
 * ```
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Formats an idle time for logging.
 *
 * @param idleMs - Idle time in milliseconds
 * @returns Formatted idle time string
 */
export function formatIdleTime(idleMs: number): string {
  return `inactive for ${formatDuration(idleMs)}`;
}

// ============================================================================
// Session Stats Formatting
// ============================================================================

/**
 * Formats session statistics for display.
 *
 * @param sessions - The sessions map
 * @param maxCount - Maximum allowed sessions
 * @returns SessionStats object
 */
export function getSessionStats(sessions: Map<string, SessionData>, maxCount: number): SessionStats {
  const sessionIds = Array.from(sessions.keys()).map((id) => formatSessionId(id));

  return {
    activeCount: sessions.size,
    maxCount,
    sessionIds,
  };
}

/**
 * Formats session stats as a log-friendly string.
 *
 * @param stats - Session statistics
 * @returns Formatted stats string
 *
 * @example
 * ```typescript
 * formatSessionStats({ activeCount: 5, maxCount: 100, sessionIds: [] });
 * // Returns: '5/100 sessions active'
 * ```
 */
export function formatSessionStats(stats: SessionStats): string {
  return `${stats.activeCount}/${stats.maxCount} sessions active`;
}

// ============================================================================
// Session List Formatting
// ============================================================================

/**
 * Formats a list of session IDs for display.
 *
 * @param sessionIds - Array of session IDs
 * @param maxDisplay - Maximum number of IDs to show (default: 5)
 * @returns Formatted session list string
 */
export function formatSessionList(sessionIds: string[], maxDisplay: number = 5): string {
  if (sessionIds.length === 0) {
    return 'no sessions';
  }

  const displayed = sessionIds.slice(0, maxDisplay).map((id) => formatSessionId(id));
  const remaining = sessionIds.length - maxDisplay;

  if (remaining > 0) {
    return `[${displayed.join(', ')} +${remaining} more]`;
  }

  return `[${displayed.join(', ')}]`;
}
