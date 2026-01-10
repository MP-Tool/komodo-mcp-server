/**
 * Session Manager
 * Manages transport session lifecycle with automatic expiration
 */

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  SESSION_TIMEOUT_MS,
  SESSION_CLEANUP_INTERVAL_MS,
  SESSION_KEEP_ALIVE_INTERVAL_MS,
  SESSION_MAX_MISSED_HEARTBEATS,
  SESSION_MAX_COUNT,
} from '../../config/index.js';
import { logger as baseLogger, formatSessionId } from '../../utils/index.js';

const logger = baseLogger.child({ component: 'transport' });

/**
 * Interface for transports that support heartbeat functionality.
 * Some transports (like StreamableHTTPServerTransport) have sendHeartbeat but it's not in the public types.
 */
interface HeartbeatCapableTransport extends Transport {
  sendHeartbeat?: () => boolean;
}

/**
 * Session data with activity tracking for expiration
 */
interface SessionData {
  transport: Transport;
  lastActivity: Date;
  missedHeartbeats: number;
}

/**
 * Manages MCP transport sessions
 *
 * Features:
 * - Session lifecycle management (add, get, remove)
 * - Activity tracking for each session
 * - Automatic expiration of idle sessions
 * - Graceful shutdown with transport cleanup
 */
export class TransportSessionManager {
  private sessions = new Map<string, SessionData>();
  private cleanupInterval: NodeJS.Timeout;
  private keepAliveInterval: NodeJS.Timeout;

  constructor() {
    // Start background cleanup task for expired sessions
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, SESSION_CLEANUP_INTERVAL_MS);

    // Start background keep-alive task
    this.keepAliveInterval = setInterval(() => {
      this.sendKeepAlives();
    }, SESSION_KEEP_ALIVE_INTERVAL_MS);

    logger.debug(
      'SessionManager started (timeout=%dm, cleanup=%ds, keepalive=%ds)',
      SESSION_TIMEOUT_MS / 60000,
      SESSION_CLEANUP_INTERVAL_MS / 1000,
      SESSION_KEEP_ALIVE_INTERVAL_MS / 1000,
    );
  }

  /**
   * Adds a transport to the session map with current timestamp.
   * Returns false if max session limit reached.
   */
  add(sessionId: string, transport: Transport): boolean {
    // Check session limit to prevent memory exhaustion
    if (this.sessions.size >= SESSION_MAX_COUNT) {
      logger.warn('Session limit reached (%d), rejecting new session', SESSION_MAX_COUNT);
      return false;
    }

    this.sessions.set(sessionId, {
      transport,
      lastActivity: new Date(),
      missedHeartbeats: 0,
    });
    logger.debug('Session [%s] added (total=%d)', formatSessionId(sessionId), this.sessions.size);
    return true;
  }

  /**
   * Gets a transport by session ID and updates activity time
   */
  get(sessionId: string): Transport | undefined {
    const session = this.sessions.get(sessionId);
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
   * Updates the last activity time for a session
   */
  touch(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      session.missedHeartbeats = 0;
    }
  }

  /**
   * Checks if a session exists
   */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Removes a transport from the session map
   */
  remove(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.debug('Session [%s] removed (remaining=%d)', formatSessionId(sessionId), this.sessions.size);
    }
    return deleted;
  }

  /**
   * Closes all active transports gracefully
   */
  async closeAll(): Promise<void> {
    logger.info(`Closing ${this.sessions.size} sessions...`);

    // Stop intervals
    clearInterval(this.cleanupInterval);
    clearInterval(this.keepAliveInterval);

    const closePromises: Promise<void>[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      closePromises.push(
        session.transport.close().catch((error) => {
          logger.error('Failed to close session [%s]: %s', formatSessionId(sessionId), error);
        }),
      );
    }

    await Promise.all(closePromises);
    this.sessions.clear();
    logger.info('All sessions closed');
  }

  /**
   * Returns the number of active sessions
   */
  get size(): number {
    return this.sessions.size;
  }

  /**
   * Removes sessions that haven't been active for the timeout period
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const idleTime = now - session.lastActivity.getTime();

      if (idleTime > SESSION_TIMEOUT_MS) {
        // Try to send heartbeat to keep active connections alive
        // This handles cases where the client is listening but not sending requests
        const transport = session.transport as HeartbeatCapableTransport;
        if (transport.sendHeartbeat && transport.sendHeartbeat()) {
          // Connection is alive, extend session
          session.lastActivity = new Date();
          continue;
        }

        logger.warn(`Session ${sessionId} timed out (inactive for ${Math.round(idleTime / 1000)}s)`);

        session.transport.close().catch((err) => {
          logger.error(`Error closing timed out session ${sessionId}:`, err);
        });

        this.sessions.delete(sessionId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info(`Cleaned up ${removedCount} expired sessions (remaining: ${this.sessions.size})`);
    }
  }

  /**
   * Sends keep-alive heartbeats to all active sessions
   * This prevents intermediate proxies or clients from closing the connection due to inactivity
   * Also proactively cleans up dead connections after threshold is reached
   */
  private sendKeepAlives(): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      const transport = session.transport as HeartbeatCapableTransport;
      if (transport.sendHeartbeat) {
        const isAlive = transport.sendHeartbeat();

        if (isAlive) {
          // Connection is healthy, reset counter
          session.missedHeartbeats = 0;
        } else {
          // Connection failed, increment counter
          session.missedHeartbeats++;

          if (session.missedHeartbeats >= SESSION_MAX_MISSED_HEARTBEATS) {
            // Threshold reached, clean up dead connection
            logger.error(`Closing dead session ${sessionId} after ${session.missedHeartbeats} failed heartbeats`);
            session.transport.close().catch((err) => {
              logger.debug('Error closing dead session (expected): %s', err);
            });
            this.sessions.delete(sessionId);
          }
        }
      }
    }
  }
}
