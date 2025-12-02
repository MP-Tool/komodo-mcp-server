/**
 * Session Manager
 * Manages transport session lifecycle with automatic expiration
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { 
    SESSION_TIMEOUT_MS, 
    SESSION_CLEANUP_INTERVAL_MS 
} from './config/transport.config.js';

/**
 * Session data with activity tracking for expiration
 */
interface SessionData {
    transport: StreamableHTTPServerTransport;
    lastActivity: Date;
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

    constructor() {
        // Start background cleanup task for expired sessions
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, SESSION_CLEANUP_INTERVAL_MS);
        
        console.error(`[SessionManager] Started with ${SESSION_TIMEOUT_MS / 60000} minute timeout`);
    }

    /**
     * Adds a transport to the session map with current timestamp
     */
    add(sessionId: string, transport: StreamableHTTPServerTransport): void {
        this.sessions.set(sessionId, {
            transport,
            lastActivity: new Date()
        });
        console.error(`[SessionManager] Session added: ${sessionId} (total: ${this.sessions.size})`);
    }

    /**
     * Gets a transport by session ID and updates activity time
     */
    get(sessionId: string): StreamableHTTPServerTransport | undefined {
        const session = this.sessions.get(sessionId);
        if (session) {
            // Update last activity time
            session.lastActivity = new Date();
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
            console.error(`[SessionManager] Session removed: ${sessionId} (remaining: ${this.sessions.size})`);
        }
        return deleted;
    }

    /**
     * Closes all active transports gracefully
     */
    async closeAll(): Promise<void> {
        console.error(`[SessionManager] Closing ${this.sessions.size} sessions...`);
        
        // Stop cleanup interval
        clearInterval(this.cleanupInterval);
        
        const closePromises: Promise<void>[] = [];

        for (const [sessionId, session] of this.sessions.entries()) {
            closePromises.push(
                session.transport.close()
                    .then(() => {
                        console.error(`[HTTP] Closed transport for session ${sessionId}`);
                    })
                    .catch((error) => {
                        console.error(`[HTTP] Error closing transport ${sessionId}:`, error);
                    })
            );
        }

        await Promise.all(closePromises);
        this.sessions.clear();
        console.error('[SessionManager] All sessions closed');
    }

    /**
     * Returns the number of active sessions
     */
    get size(): number {
        return this.sessions.size;
    }

    /**
     * Cleans up expired sessions based on inactivity timeout
     * MCP Spec: Server MAY terminate session at any time
     */
    private cleanupExpiredSessions(): void {
        const now = Date.now();
        let expiredCount = 0;

        for (const [sessionId, session] of this.sessions.entries()) {
            const idleTime = now - session.lastActivity.getTime();
            
            if (idleTime > SESSION_TIMEOUT_MS) {
                console.error(`[SessionManager] Expiring idle session: ${sessionId} (idle: ${Math.round(idleTime / 60000)} min)`);
                session.transport.close().catch(err => 
                    console.error('[SessionManager] Error closing expired transport:', err)
                );
                this.sessions.delete(sessionId);
                expiredCount++;
            }
        }

        if (expiredCount > 0) {
            console.error(`[SessionManager] Cleaned up ${expiredCount} expired session(s). Active: ${this.sessions.size}`);
        }
    }
}
