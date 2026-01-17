/**
 * Session Heartbeat Module
 *
 * Handles keep-alive heartbeats for active sessions.
 * Heartbeats prevent intermediate proxies or clients from
 * closing connections due to inactivity.
 *
 * Also proactively cleans up dead connections after a
 * threshold of missed heartbeats is reached.
 *
 * @module session/operations/heartbeat
 */

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { logger as baseLogger } from '../../logger/index.js';
import type { SessionData, HeartbeatCapableTransport } from '../core/index.js';
import { SESSION_LOG_COMPONENT, SessionLogMessages } from '../core/index.js';
import { formatSessionId } from '../utils/index.js';

const logger = baseLogger.child({ component: SESSION_LOG_COMPONENT });

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a transport supports heartbeat functionality.
 *
 * This provides type-safe access to the sendHeartbeat method without
 * requiring unsafe type casts throughout the codebase.
 *
 * @param transport - The transport to check
 * @returns true if the transport has a sendHeartbeat method
 *
 * @example
 * ```typescript
 * if (hasHeartbeat(transport)) {
 *   // TypeScript knows transport.sendHeartbeat exists
 *   const isAlive = transport.sendHeartbeat();
 * }
 * ```
 */
export function hasHeartbeat(
  transport: Transport,
): transport is HeartbeatCapableTransport & { sendHeartbeat: () => boolean } {
  return (
    typeof transport === 'object' &&
    transport !== null &&
    'sendHeartbeat' in transport &&
    typeof (transport as HeartbeatCapableTransport).sendHeartbeat === 'function'
  );
}

/**
 * Safely sends a heartbeat to a transport that supports it.
 *
 * @param transport - A transport with heartbeat capability
 * @returns true if heartbeat succeeded, false otherwise
 */
export function sendHeartbeatSafe(transport: HeartbeatCapableTransport & { sendHeartbeat: () => boolean }): boolean {
  try {
    return transport.sendHeartbeat();
  } catch {
    return false;
  }
}

// ============================================================================
// Heartbeat Operations
// ============================================================================

/**
 * Information about a removed session during heartbeat.
 */
export interface RemovedSession {
  /** The session ID that was removed */
  sessionId: string;
  /** Number of missed heartbeats before removal */
  missedHeartbeats: number;
}

/**
 * Result of a heartbeat round.
 */
export interface HeartbeatResult {
  /** Number of successful heartbeats */
  successCount: number;
  /** Number of failed heartbeats */
  failedCount: number;
  /** Number of dead sessions removed */
  removedCount: number;
  /** Sessions that were removed due to dead connection (detailed info) */
  removedSessions: RemovedSession[];
}

/**
 * Sends keep-alive heartbeats to all active sessions.
 *
 * This prevents intermediate proxies or clients from closing
 * the connection due to inactivity. Also proactively cleans up
 * dead connections after threshold is reached.
 *
 * @param sessions - The sessions map
 * @param maxMissedHeartbeats - Threshold for dead session detection
 * @returns Heartbeat result with counts
 */
export function sendKeepAlives(sessions: Map<string, SessionData>, maxMissedHeartbeats: number): HeartbeatResult {
  let successCount = 0;
  let failedCount = 0;
  const removedSessions: RemovedSession[] = [];

  for (const [sessionId, session] of sessions.entries()) {
    // Use type guard instead of unsafe cast
    if (!hasHeartbeat(session.transport)) {
      // Skip transports without heartbeat support
      continue;
    }

    const isAlive = sendHeartbeatSafe(session.transport);

    if (isAlive) {
      // Connection is healthy, reset counter
      session.missedHeartbeats = 0;
      successCount++;
    } else {
      // Connection failed, increment counter
      session.missedHeartbeats++;
      failedCount++;

      if (session.missedHeartbeats >= maxMissedHeartbeats) {
        // Threshold reached, clean up dead connection
        logger.error(SessionLogMessages.DEAD_SESSION_CLOSED, formatSessionId(sessionId), session.missedHeartbeats);

        session.transport.close().catch((err) => {
          logger.debug('Error closing dead session (expected): %s', err);
        });

        sessions.delete(sessionId);
        removedSessions.push({ sessionId, missedHeartbeats: session.missedHeartbeats });
      }
    }
  }

  return {
    successCount,
    failedCount,
    removedCount: removedSessions.length,
    removedSessions,
  };
}

/**
 * Sends a heartbeat to a single session.
 *
 * @param session - The session to heartbeat
 * @returns true if heartbeat succeeded, false otherwise
 */
export function sendHeartbeat(session: SessionData): boolean {
  // Use type guard instead of unsafe cast
  if (!hasHeartbeat(session.transport)) {
    // Transport doesn't support heartbeat, assume alive
    return true;
  }

  const isAlive = sendHeartbeatSafe(session.transport);

  if (isAlive) {
    session.missedHeartbeats = 0;
  } else {
    session.missedHeartbeats++;
  }

  return isAlive;
}

/**
 * Checks if a session has exceeded the missed heartbeat threshold.
 *
 * @param session - The session to check
 * @param maxMissedHeartbeats - Threshold for dead session detection
 * @returns true if session is considered dead
 */
export function isSessionDead(session: SessionData, maxMissedHeartbeats: number): boolean {
  return session.missedHeartbeats >= maxMissedHeartbeats;
}
