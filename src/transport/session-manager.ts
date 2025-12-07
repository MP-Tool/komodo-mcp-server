/**
 * Session Manager
 * Manages transport session lifecycle with automatic expiration
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  SESSION_TIMEOUT_MS,
  SESSION_CLEANUP_INTERVAL_MS,
  SESSION_KEEP_ALIVE_INTERVAL_MS,
  SESSION_MAX_MISSED_HEARTBEATS,
} from './config/transport.config.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ component: 'transport' });

/**
 * Session data with activity tracking for expiration
 */
interface SessionData {
  transport: StreamableHTTPServerTransport;
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

    logger.debug(`Started with ${SESSION_TIMEOUT_MS / 60000} minute timeout`);
  }

  /**
   * Adds a transport to the session map with current timestamp
   */
  add(sessionId: string, transport: StreamableHTTPServerTransport): void {
    this.sessions.set(sessionId, {
      transport,
      lastActivity: new Date(),
      missedHeartbeats: 0,
    });
    logger.debug(`Session added: ${sessionId} (total: ${this.sessions.size})`);
  }

  /**
   * Gets a transport by session ID and updates activity time
   */
  get(sessionId: string): StreamableHTTPServerTransport | undefined {
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
      logger.debug(`Session removed: ${sessionId} (remaining: ${this.sessions.size})`);
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
        session.transport
          .close()
          .then(() => {
            logger.debug(`Closed transport for session ${sessionId}`);
          })
          .catch((error) => {
            logger.error(`Error closing transport ${sessionId}:`, error);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transport = session.transport as any;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transport = session.transport as any;
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
            session.transport.close().catch(() => {});
            this.sessions.delete(sessionId);
          }
        }
      }
    }
  }
}
