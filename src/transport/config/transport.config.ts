/**
 * Transport layer configuration
 * Centralized configuration to avoid duplication
 */

import { config } from '../../config/env.js';

/**
 * Supported MCP protocol versions
 * Spec: https://modelcontextprotocol.io/specification/versioning
 * Current version: 2025-06-18 (but 2024-11-05 is still widely used)
 */
export const SUPPORTED_PROTOCOL_VERSIONS = [
    '2025-11-25',  // Newest release
    '2025-06-18',  // Previous spec version
    '2024-11-05',  // Legacy stable version
] as const;

/**
 * Fallback protocol version for backwards compatibility
 * Used when client doesn't send MCP-Protocol-Version header
 */
export const FALLBACK_PROTOCOL_VERSION = '2024-11-05';

/**
 * Session timeout in milliseconds
 * Sessions expire after 30 minutes of inactivity
 */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Session cleanup interval in milliseconds
 * Expired sessions are cleaned up every minute
 */
export const SESSION_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Session keep-alive interval in milliseconds
 * Sends a heartbeat every 30 seconds to prevent connection timeouts
 */
export const SESSION_KEEP_ALIVE_INTERVAL_MS = 30 * 1000; // 30 seconds

/**
 * Maximum number of missed heartbeats before closing session
 * Allows for temporary network glitches (e.g. 3 * 30s = 90s tolerance)
 */
export const SESSION_MAX_MISSED_HEARTBEATS = 3;

/**
 * Generates allowed hosts list for DNS rebinding protection
 */
export function getAllowedHosts(): string[] {
    const port = config.MCP_PORT;
    const defaults = [
        'localhost',
        '127.0.0.1',
        `localhost:${port}`,
        `127.0.0.1:${port}`,
    ];
    
    if (config.MCP_ALLOWED_HOSTS) {
        return [...defaults, ...config.MCP_ALLOWED_HOSTS];
    }
    
    return defaults;
}

/**
 * Generates allowed origins list for CORS validation
 * Only used when server is bound to non-localhost addresses
 */
export function getAllowedOrigins(): string[] {
    const port = config.MCP_PORT;
    return [
        `http://localhost:${port}`,
        `http://127.0.0.1:${port}`,
    ];
}

/**
 * JSON-RPC error codes
 * Spec: https://www.jsonrpc.org/specification#error_object
 */
export const JSON_RPC_ERROR_CODES = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    // MCP-specific error codes
    SESSION_NOT_FOUND: -32001,
    FORBIDDEN: -32000,
} as const;
