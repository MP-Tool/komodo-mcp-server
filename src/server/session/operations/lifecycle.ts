/**
 * Session Lifecycle Module
 *
 * Handles session lifecycle operations:
 * - Adding new sessions
 * - Retrieving sessions
 * - Updating session activity
 * - Removing sessions
 *
 * This module provides pure functions that operate on a sessions Map,
 * following the functional programming pattern for better testability.
 *
 * @module session/operations/lifecycle
 */

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { logger as baseLogger } from '../../../utils/index.js';
import type { SessionData } from '../core/index.js';
import { SESSION_LOG_COMPONENT, SessionLogMessages } from '../core/index.js';
import { formatSessionId } from '../utils/index.js';

const logger = baseLogger.child({ component: SESSION_LOG_COMPONENT });

// ============================================================================
// Session Creation
// ============================================================================

/**
 * Creates a new session data object.
 *
 * @param transport - The MCP transport instance
 * @returns New SessionData with current timestamp
 */
export function createSessionData(transport: Transport): SessionData {
  const now = new Date();
  return {
    transport,
    createdAt: now,
    lastActivity: now,
    missedHeartbeats: 0,
  };
}

// ============================================================================
// Session Operations
// ============================================================================

/**
 * Adds a transport to the sessions map.
 *
 * @param sessions - The sessions map to add to
 * @param sessionId - Unique session identifier
 * @param transport - MCP transport instance
 * @param maxCount - Maximum allowed sessions
 * @returns true if added successfully, false if limit reached
 */
export function addSession(
  sessions: Map<string, SessionData>,
  sessionId: string,
  transport: Transport,
  maxCount: number,
): boolean {
  // Check session limit to prevent memory exhaustion
  if (sessions.size >= maxCount) {
    logger.warn(SessionLogMessages.SESSION_LIMIT_REACHED, maxCount);
    return false;
  }

  sessions.set(sessionId, createSessionData(transport));
  logger.debug(SessionLogMessages.SESSION_ADDED, formatSessionId(sessionId), sessions.size);
  return true;
}

/**
 * Gets a transport by session ID and updates activity time.
 *
 * @param sessions - The sessions map to query
 * @param sessionId - Session identifier to look up
 * @returns The transport if found, undefined otherwise
 */
export function getSession(sessions: Map<string, SessionData>, sessionId: string): Transport | undefined {
  const session = sessions.get(sessionId);
  if (session) {
    // Update last activity time
    session.lastActivity = new Date();
    // Reset missed heartbeats on active usage
    session.missedHeartbeats = 0;
    return session.transport;
  }
  return undefined;
}

/**
 * Updates the last activity time for a session.
 *
 * @param sessions - The sessions map
 * @param sessionId - Session identifier to touch
 */
export function touchSession(sessions: Map<string, SessionData>, sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
    session.missedHeartbeats = 0;
  }
}

/**
 * Checks if a session exists.
 *
 * @param sessions - The sessions map
 * @param sessionId - Session identifier to check
 * @returns true if session exists
 */
export function hasSession(sessions: Map<string, SessionData>, sessionId: string): boolean {
  return sessions.has(sessionId);
}

/**
 * Removes a transport from the sessions map.
 *
 * @param sessions - The sessions map
 * @param sessionId - Session identifier to remove
 * @returns true if removed, false if not found
 */
export function removeSession(sessions: Map<string, SessionData>, sessionId: string): boolean {
  const deleted = sessions.delete(sessionId);
  if (deleted) {
    logger.debug(SessionLogMessages.SESSION_REMOVED, formatSessionId(sessionId), sessions.size);
  }
  return deleted;
}

/**
 * Closes all sessions gracefully.
 *
 * @param sessions - The sessions map
 * @returns Promise that resolves when all sessions are closed
 */
export async function closeAllSessions(sessions: Map<string, SessionData>): Promise<void> {
  logger.info(SessionLogMessages.CLOSING_SESSIONS, sessions.size);

  const closePromises: Promise<void>[] = [];

  for (const [sessionId, session] of sessions.entries()) {
    closePromises.push(
      session.transport.close().catch((error) => {
        logger.error(SessionLogMessages.CLOSE_ERROR, formatSessionId(sessionId), error);
      }),
    );
  }

  await Promise.all(closePromises);
  sessions.clear();
  logger.info(SessionLogMessages.ALL_SESSIONS_CLOSED);
}
