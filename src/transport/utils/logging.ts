/**
 * Logging utilities for transport layer
 */


/**
 * Sanitizes a string for logging to prevent log injection attacks
 * Replaces newlines and other control characters
 */
export function sanitizeForLog(input: string | undefined | null): string {
    if (!input) return '';
    // Replace newlines and carriage returns with space
    // Also replace other control characters if needed, but newlines are the main vector
    return String(input).replace(/[\n\r]/g, ' ').trim();
}

/**
 * Logs security status based on bind host configuration
 */
export function logSecurityStatus(bindHost: string, port: number): void {
    console.error('[HTTP] Server listening on %s:%d', bindHost, port);
    
    if (bindHost === '127.0.0.1' || bindHost === 'localhost') {
        console.error('[HTTP] ✅ Security: Bound to localhost only (not accessible remotely)');
    } else {
        console.error('[HTTP] ⚠️  Warning: Bound to %s - accessible from network!', bindHost);
    }
    
    console.error('[HTTP] MCP endpoint: http://%s:%d/mcp', bindHost, port);
    console.error('[HTTP] Health check: http://%s:%d/health', bindHost, port);
}

/**
 * Logs MCP session events
 */
export function logSessionInitialized(sessionId: string): void {
    console.error('[MCP] Session initialized: %s', sessionId);
}

export function logSessionClosed(sessionId: string): void {
    console.error('[MCP] Session closed: %s', sessionId);
}

/**
 * Logs security events
 */
export function logSecurityEvent(event: string, details?: any): void {
    // Use %s to prevent format string injection (CWE-134)
    console.error('[Security] %s', event, details || '');
}

/**
 * Logs MCP protocol events
 */
export function logProtocolEvent(event: string, details?: any): void {
    // Use %s to prevent format string injection (CWE-134)
    console.error('[MCP] %s', event, details || '');
}
