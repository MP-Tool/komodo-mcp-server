/**
 * JSON-RPC Constants Module
 *
 * JSON-RPC 2.0 specification compliant error codes.
 * Used for MCP protocol communication.
 *
 * @see https://www.jsonrpc.org/specification#error_object
 * @module server/errors/core/json-rpc
 */

// ============================================================================
// JSON-RPC Error Codes (MCP Spec Compliant)
// ============================================================================

/**
 * Standard JSON-RPC 2.0 error codes.
 *
 * Range -32700 to -32600: Spec-defined errors
 * Range -32000 to -32099: Implementation-defined server errors
 */
export const JsonRpcErrorCode = {
  // ─────────────────────────────────────────────────────────────────────────
  // Spec-defined errors (-32700 to -32600)
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
// JSON-RPC Error Code Utilities
// ============================================================================

/**
 * Check if an error code is a spec-defined JSON-RPC error.
 */
export function isSpecDefinedJsonRpcError(code: number): boolean {
  return code >= -32700 && code <= -32600;
}

/**
 * Check if an error code is an implementation-defined server error.
 */
export function isServerDefinedJsonRpcError(code: number): boolean {
  return code >= -32099 && code <= -32000;
}

/**
 * Check if an error code is a valid JSON-RPC error code.
 */
export function isValidJsonRpcErrorCode(code: number): boolean {
  return isSpecDefinedJsonRpcError(code) || isServerDefinedJsonRpcError(code);
}
