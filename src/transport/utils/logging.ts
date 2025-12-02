/**
 * Logging utilities for transport layer
 */


/**
 * Logs security status based on bind host configuration
 */
export function logSecurityStatus(bindHost: string, port: number): void {
    console.error(`[HTTP] Server listening on ${bindHost}:${port}`);
    
    if (bindHost === '127.0.0.1' || bindHost === 'localhost') {
        console.error('[HTTP] ✅ Security: Bound to localhost only (not accessible remotely)');
    } else {
        console.error(`[HTTP] ⚠️  Warning: Bound to ${bindHost} - accessible from network!`);
    }
    
    console.error(`[HTTP] MCP endpoint: http://${bindHost}:${port}/mcp`);
    console.error(`[HTTP] Health check: http://${bindHost}:${port}/health`);
}

/**
 * Logs MCP session events
 */
export function logSessionInitialized(sessionId: string): void {
    console.error(`[MCP] Session initialized: ${sessionId}`);
}

export function logSessionClosed(sessionId: string): void {
    console.error(`[MCP] Session closed: ${sessionId}`);
}

/**
 * Logs security events
 */
export function logSecurityEvent(event: string, details?: any): void {
    console.error(`[Security] ${event}`, details || '');
}

/**
 * Logs MCP protocol events
 */
export function logProtocolEvent(event: string, details?: any): void {
    console.error(`[MCP] ${event}`, details || '');
}
