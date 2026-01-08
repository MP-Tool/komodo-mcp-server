/**
 * Transport Layer Configuration
 *
 * Configuration for MCP transport layer including session management,
 * protocol versions, timeouts, and security settings.
 *
 * @module config/transport
 */

import { config } from './env.js';

// ============================================================================
// Protocol Version Configuration
// ============================================================================

/**
 * Supported MCP protocol versions
 * Spec: https://modelcontextprotocol.io/specification/versioning
 */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-11-25', // Latest release
  '2025-06-18',
  '2025-03-26',
  '2024-11-05', // SSE Discontinuation release
] as const;

/**
 * Fallback protocol version for backwards compatibility
 * Used when client doesn't send MCP-Protocol-Version header
 */
export const FALLBACK_PROTOCOL_VERSION = '2024-11-05';

// ============================================================================
// Session Management Configuration
// ============================================================================

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
 * Maximum number of concurrent HTTP sessions
 * Prevents memory exhaustion from too many open sessions
 */
export const SESSION_MAX_COUNT = 100;

/**
 * Maximum number of concurrent Legacy SSE sessions
 * Separate limit as these hold open connections
 */
export const LEGACY_SSE_MAX_SESSIONS = 50;

// ============================================================================
// Security Configuration
// ============================================================================

/**
 * Generates allowed hosts list for DNS rebinding protection
 */
export function getAllowedHosts(): string[] {
  const port = config.MCP_PORT;
  // prettier-ignore
  const defaults = [
    'localhost',
    '127.0.0.1',
    '[::1]',
    `localhost:${port}`,
    `127.0.0.1:${port}`,
    `[::1]:${port}`,
  ];

  if (config.MCP_ALLOWED_HOSTS && config.MCP_ALLOWED_HOSTS.length > 0) {
    return config.MCP_ALLOWED_HOSTS;
  }

  return defaults;
}

/**
 * Generates allowed origins list for CORS validation
 * Only used when server is bound to non-localhost addresses
 */
export function getAllowedOrigins(): string[] {
  const port = config.MCP_PORT;
  // prettier-ignore
  const defaults = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `http://[::1]:${port}`,
  ];

  if (config.MCP_ALLOWED_ORIGINS && config.MCP_ALLOWED_ORIGINS.length > 0) {
    return config.MCP_ALLOWED_ORIGINS;
  }

  return defaults;
}

/**
 * Checks if a host is a local loopback address
 * Allows any port on localhost/127.0.0.1/[::1]
 */
export function isLocalHost(host: string): boolean {
  const cleanHost = host.trim();
  return (
    cleanHost.startsWith('localhost:') ||
    cleanHost === 'localhost' ||
    cleanHost.startsWith('127.0.0.1:') ||
    cleanHost === '127.0.0.1' ||
    cleanHost.startsWith('[::1]:') ||
    cleanHost === '[::1]'
  );
}
