/**
 * Error Constants Module
 *
 * Centralized constants for the error system:
 * - JSON-RPC error codes (MCP spec compliant)
 * - HTTP status codes
 * - Validation limits
 *
 * @module errors/core/constants
 */

// ============================================================================
// JSON-RPC Error Codes (MCP Spec Compliant)
// https://www.jsonrpc.org/specification#error_object
// ============================================================================

/**
 * Standard JSON-RPC error codes.
 *
 * Range -32700 to -32600: Spec-defined errors
 * Range -32000 to -32099: Implementation-defined server errors
 */
export const JsonRpcErrorCode = {
  // ─────────────────────────────────────────────────────────────────────────
  // Spec-defined errors
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // Implementation-defined server errors (-32000 to -32099)
  // ─────────────────────────────────────────────────────────────────────────
  /** Generic server error */
  SERVER_ERROR: -32000,
  /** Session not found or expired */
  SESSION_NOT_FOUND: -32001,
  /** Request was cancelled */
  REQUEST_CANCELLED: -32002,
} as const;

export type JsonRpcErrorCodeType = (typeof JsonRpcErrorCode)[keyof typeof JsonRpcErrorCode];

// ============================================================================
// HTTP Status Codes
// ============================================================================

/**
 * HTTP Status Codes used in the transport layer.
 */
export const HttpStatus = {
  // ─────────────────────────────────────────────────────────────────────────
  // Success (2xx)
  // ─────────────────────────────────────────────────────────────────────────
  OK: 200,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // ─────────────────────────────────────────────────────────────────────────
  // Client Errors (4xx)
  // ─────────────────────────────────────────────────────────────────────────
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  UNSUPPORTED_MEDIA_TYPE: 415,
  /** Client Closed Request (nginx convention) */
  CLIENT_CLOSED_REQUEST: 499,

  // ─────────────────────────────────────────────────────────────────────────
  // Server Errors (5xx)
  // ─────────────────────────────────────────────────────────────────────────
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatusType = (typeof HttpStatus)[keyof typeof HttpStatus];

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * Validation limits for error handling.
 */
export const VALIDATION_LIMITS = {
  /** Maximum string length to display in error messages */
  MAX_STRING_DISPLAY_LENGTH: 100,
  /** Maximum array items to display in error messages */
  MAX_ARRAY_DISPLAY_ITEMS: 5,
  /** Maximum object keys to display in error messages */
  MAX_OBJECT_DISPLAY_KEYS: 5,
} as const;

// ============================================================================
// Sensitive Field Patterns
// ============================================================================

/**
 * Field names that should be redacted in error messages.
 */
export const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /jwt/i,
  /bearer/i,
  /auth/i,
  /credential/i,
  /api[_-]?key/i,
] as const;

/**
 * Check if a field name is sensitive and should be redacted.
 */
export function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(fieldName));
}
