/**
 * Session Cleanup Module
 *
 * Handles cleanup of expired sessions based on timeout configuration.
 * This module runs periodically to remove sessions that have been
 * inactive for longer than the configured timeout.
 *
 * @module session/operations/cleanup
 */

import { logger as baseLogger } from '../../../utils/index.js';
import type { SessionData } from '../core/index.js';
import { SESSION_LOG_COMPONENT, SessionLogMessages } from '../core/index.js';
import { formatSessionId } from '../utils/index.js';
import { hasHeartbeat, sendHeartbeatSafe } from './heartbeat.js';

const logger = baseLogger.child({ component: SESSION_LOG_COMPONENT });

// ============================================================================
// Cleanup Types
// ============================================================================

/**
 * Information about a cleaned up session.
 */
export interface CleanedSession {
  /** The session ID that was cleaned up */
  sessionId: string;
  /** How long the session was idle before cleanup (ms) */
  idleTimeMs: number;
  /** Total session duration from creation to cleanup (ms) */
  durationMs: number;
}

/**
 * Information about an extended session.
 */
export interface ExtendedSession {
  /** The session ID that was extended */
  sessionId: string;
}

/**
 * Result of a cleanup operation.
 */
export interface CleanupResult {
  /** Number of sessions removed */
  removedCount: number;
  /** Number of sessions extended via heartbeat */
  extendedCount: number;
  /** Remaining session count */
  remainingCount: number;
  /** Session IDs that were removed (for event emission) */
  removedSessions: CleanedSession[];
  /** Session IDs that were extended (for event emission) */
  extendedSessions: ExtendedSession[];
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Removes sessions that haven't been active for the timeout period.
 *
 * For sessions that appear expired, attempts to send a heartbeat first.
 * If the heartbeat succeeds, the session is extended rather than removed.
 *
 * @param sessions - The sessions map to clean up
 * @param timeoutMs - Session timeout in milliseconds
 * @returns Cleanup result with counts and session IDs
 */
export function cleanupExpiredSessions(sessions: Map<string, SessionData>, timeoutMs: number): CleanupResult {
  const now = Date.now();
  const removedSessions: CleanedSession[] = [];
  const extendedSessions: ExtendedSession[] = [];

  for (const [sessionId, session] of sessions.entries()) {
    const idleTime = now - session.lastActivity.getTime();

    if (idleTime > timeoutMs) {
      // Try to send heartbeat to keep active connections alive
      // This handles cases where the client is listening but not sending requests
      if (hasHeartbeat(session.transport) && sendHeartbeatSafe(session.transport)) {
        // Connection is alive, extend session
        session.lastActivity = new Date();
        extendedSessions.push({ sessionId });
        logger.debug(SessionLogMessages.HEARTBEAT_EXTENDED, formatSessionId(sessionId));
        continue;
      }

      // Session is truly expired
      const idleSeconds = Math.round(idleTime / 1000);
      logger.warn(SessionLogMessages.SESSION_TIMED_OUT, sessionId, idleSeconds);

      // Calculate duration BEFORE removing the session
      const durationMs = now - session.createdAt.getTime();

      // Close transport gracefully
      session.transport.close().catch((err) => {
        logger.debug('Error closing timed out session (expected): %s', err);
      });

      sessions.delete(sessionId);
      removedSessions.push({ sessionId, idleTimeMs: idleTime, durationMs });
    }
  }

  if (removedSessions.length > 0) {
    logger.info(SessionLogMessages.CLEANUP_COMPLETED, removedSessions.length, sessions.size);
  }

  return {
    removedCount: removedSessions.length,
    extendedCount: extendedSessions.length,
    remainingCount: sessions.size,
    removedSessions,
    extendedSessions,
  };
}

/**
 * Calculates the idle time for a session in milliseconds.
 *
 * @param session - The session to check
 * @returns Idle time in milliseconds
 */
export function getSessionIdleTime(session: SessionData): number {
  return Date.now() - session.lastActivity.getTime();
}

/**
 * Checks if a session is expired based on timeout.
 *
 * @param session - The session to check
 * @param timeoutMs - Timeout in milliseconds
 * @returns true if session is expired
 */
export function isSessionExpired(session: SessionData, timeoutMs: number): boolean {
  return getSessionIdleTime(session) > timeoutMs;
}
