/**
 * Transport Core Constants
 *
 * Centralized constants for the transport layer.
 * Eliminates magic numbers and provides consistent error codes/messages.
 *
 * @module server/transport/core/constants
 */

// ============================================================================
// JSON-RPC Error Codes (Standard)
// ============================================================================

/**
 * Standard JSON-RPC 2.0 error codes.
 *
 * @see https://www.jsonrpc.org/specification#error_object
 */
export const JSON_RPC_ERROR_CODES = {
  /** Invalid JSON was received by the server */
  PARSE_ERROR: -32700,
  /** The JSON sent is not a valid Request object */
  INVALID_REQUEST: -32600,
  /** The method does not exist / is not available */
  METHOD_NOT_FOUND: -32601,
  /** Invalid method parameter(s) */
  INVALID_PARAMS: -32602,
  /** Internal JSON-RPC error */
  INTERNAL_ERROR: -32603,
  /** Server error range start (reserved) */
  SERVER_ERROR_START: -32099,
  /** Server error range end (reserved) */
  SERVER_ERROR_END: -32000,
} as const;

// ============================================================================
// Transport-Specific Error Codes
// ============================================================================

/**
 * Transport-specific error codes (within server error range).
 * Used for transport layer errors like session management and security.
 */
export const TRANSPORT_ERROR_CODES = {
  /** Generic server error (DNS rebinding, forbidden, etc.) */
  SERVER_ERROR: -32000,
  /** Session not found */
  SESSION_NOT_FOUND: -32001,
  /** Session expired */
  SESSION_EXPIRED: -32002,
  /** Invalid origin header */
  INVALID_ORIGIN: -32003,
  /** DNS rebinding attack detected */
  DNS_REBINDING: -32004,
  /** Rate limit exceeded */
  RATE_LIMITED: -32005,
} as const;

// ============================================================================
// Log Components
// ============================================================================

/**
 * Logger component names for transport layer.
 * Used for consistent log categorization.
 */
export const TRANSPORT_LOG_COMPONENTS = {
  /** Main HTTP server */
  HTTP_SERVER: 'HttpServer',
  /** Streamable HTTP transport */
  STREAMABLE_HTTP: 'StreamableHttp',
  /** Legacy SSE transport */
  SSE: 'Sse',
  /** Middleware layer */
  MIDDLEWARE: 'Middleware',
  /** Rate limiting */
  RATE_LIMIT: 'RateLimit',
  /** DNS rebinding protection */
  DNS_PROTECTION: 'DnsProtection',
  /** Session management */
  SESSION: 'Session',
  /** Health endpoints */
  HEALTH: 'Health',
} as const;

// ============================================================================
// Error Messages
// ============================================================================

/**
 * Transport error messages.
 * Centralized for consistency and easy localization.
 */
export const TransportErrorMessages = {
  // Session errors
  SESSION_NOT_FOUND: 'Session not found',
  SESSION_EXPIRED: 'Session has expired',
  SESSION_LIMIT_REACHED: 'Maximum session limit reached',

  // Validation errors
  INVALID_CONTENT_TYPE: 'Content-Type must be application/json',
  INVALID_ACCEPT_HEADER: 'Invalid Accept header',
  MISSING_ACCEPT_HEADER: 'Accept header is required',
  INVALID_JSON: 'Invalid JSON in request body',
  INVALID_JSONRPC: 'Invalid JSON-RPC message',
  INVALID_JSONRPC_VERSION: 'JSON-RPC version must be 2.0',
  INVALID_JSONRPC_BATCH: 'Empty batch is not allowed',
  INVALID_PROTOCOL_VERSION: 'Unsupported MCP protocol version',

  // Security errors
  DNS_REBINDING_BLOCKED: 'Forbidden: Invalid Host header',
  ORIGIN_NOT_ALLOWED: 'Forbidden: Invalid Origin header',
  RATE_LIMIT_EXCEEDED: 'Too many requests from this IP, please try again later.',
} as const;

/**
 * Creates a formatted protocol version error message.
 *
 * @param version - The unsupported version received
 * @param supported - Array of supported versions
 * @returns Formatted error message
 */
export function formatProtocolVersionError(version: string, supported: readonly string[]): string {
  return `Unsupported MCP-Protocol-Version: ${version}. Supported versions: ${supported.join(', ')}`;
}
