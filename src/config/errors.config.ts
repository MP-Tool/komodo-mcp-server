/**
 * Error Configuration
 *
 * Centralized error codes and messages for:
 * - MCP JSON-RPC errors (spec-compliant)
 * - HTTP response errors
 * - Tool-specific errors
 *
 * @module config/errors
 */

// ============================================================================
// JSON-RPC Error Codes (MCP Spec compliant)
// https://www.jsonrpc.org/specification#error_object
// ============================================================================

/**
 * Standard JSON-RPC error codes
 */
export const JsonRpcErrorCode = {
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

  // Server errors (reserved for implementation-defined server-errors: -32000 to -32099)
  /** Generic server error */
  SERVER_ERROR: -32000,
  /** Session not found or expired */
  SESSION_NOT_FOUND: -32001,
  /** Request was cancelled */
  REQUEST_CANCELLED: -32002,
} as const;

export type JsonRpcErrorCodeValue = (typeof JsonRpcErrorCode)[keyof typeof JsonRpcErrorCode];

// ============================================================================
// HTTP Status Codes
// ============================================================================

/**
 * HTTP Status Codes used in the transport layer
 */
export const HttpStatus = {
  // Success
  OK: 200,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client Errors
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  UNSUPPORTED_MEDIA_TYPE: 415,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================================================
// Transport-Specific Error Messages
// ============================================================================

/**
 * Transport layer error messages
 */
export const TransportErrorMessage = {
  // Session errors
  SESSION_ID_REQUIRED: 'Mcp-Session-Id header required',
  SESSION_ID_OR_PARAM_REQUIRED: 'Mcp-Session-Id header or query param required',
  SESSION_NOT_FOUND: 'Session not found or expired',
  SESSION_NOT_FOUND_REINIT: 'Session not found or expired. Please re-initialize.',
  TOO_MANY_SESSIONS: 'Service unavailable: too many active sessions',

  // Content errors
  MISSING_ACCEPT_HEADER: 'Missing Accept header',
  INVALID_CONTENT_TYPE: 'Content-Type must be application/json',
  INVALID_JSON: 'Invalid JSON',
  INVALID_JSONRPC_VERSION: 'Invalid JSON-RPC version',
  MISSING_JSONRPC_METHOD: 'Missing method field',
  INVALID_JSONRPC_BATCH: 'Invalid batch request: array must not be empty',

  // Transport state
  TRANSPORT_CLOSED: 'Transport is closed',

  // Generic
  INTERNAL_ERROR: 'Internal server error',
} as const;

// ============================================================================
// Tool Error Messages
// ============================================================================

/**
 * Tool-specific error messages
 *
 * Used across all tool handlers for consistent error messaging.
 */
export const ERROR_MESSAGES = {
  CLIENT_NOT_INITIALIZED: 'Komodo client not initialized. Call komodo_configure first.',
  INVALID_SERVER_ID: 'Invalid server ID or name provided',
  INVALID_CONTAINER_ID: 'Invalid container ID or name provided',
  INVALID_DEPLOYMENT_ID: 'Invalid deployment ID or name provided',
  INVALID_STACK_ID: 'Invalid stack ID or name provided',
  OPERATION_FAILED: 'Operation failed',
} as const;
