/**
 * Framework Error Messages Module
 *
 * Centralized message registry with interpolation support for framework errors.
 * Contains only application-agnostic messages for:
 * - MCP/Transport errors
 * - Validation errors
 * - Operation lifecycle errors
 * - System/Internal errors
 *
 * App-specific messages (API, Auth, Resource) should be defined in app/errors/messages.ts
 *
 * @module server/errors/core/messages
 */

// ============================================================================
// Framework Message Definitions
// ============================================================================

/**
 * Framework error message definitions.
 *
 * Template syntax: `{variableName}` for interpolation
 */
export const FrameworkMessages = {
  // ─────────────────────────────────────────────────────────────────────────
  // MCP/Transport Errors
  // ─────────────────────────────────────────────────────────────────────────
  MCP_SESSION_REQUIRED: 'Mcp-Session-Id header required',
  MCP_SESSION_NOT_FOUND: 'Session not found or expired',
  MCP_SESSION_EXPIRED: 'Session has expired. Please re-initialize.',
  MCP_TOO_MANY_SESSIONS: 'Service unavailable: too many active sessions',
  MCP_INVALID_CONTENT_TYPE: 'Content-Type must be application/json',
  MCP_INVALID_JSON: 'Invalid JSON',
  MCP_INVALID_JSONRPC: 'Invalid JSON-RPC version',
  MCP_MISSING_METHOD: 'Missing method field',
  MCP_INVALID_BATCH: 'Invalid batch request: array must not be empty',
  MCP_TRANSPORT_CLOSED: 'Transport is closed',
  MCP_TRANSPORT_NOT_STARTED: 'Transport not started',
  MCP_REQUEST_CANCELLED: 'Request was cancelled',
  MCP_MISSING_ACCEPT: 'Missing Accept header',

  // ─────────────────────────────────────────────────────────────────────────
  // Validation Errors
  // ─────────────────────────────────────────────────────────────────────────
  VALIDATION_FAILED: 'Validation failed',
  VALIDATION_FIELD_REQUIRED: "Field '{field}' is required",
  VALIDATION_FIELD_INVALID: "Invalid value for field '{field}'",
  VALIDATION_FIELD_TYPE: "Field '{field}' must be of type {expectedType}",
  VALIDATION_FIELD_MIN: "Field '{field}' must be at least {min}",
  VALIDATION_FIELD_MAX: "Field '{field}' must be at most {max}",
  VALIDATION_FIELD_PATTERN: "Field '{field}' does not match the required pattern",

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration Errors (generic)
  // ─────────────────────────────────────────────────────────────────────────
  CONFIG_MISSING_ENV: 'Missing required environment variable: {varName}',
  CONFIG_INVALID_ENV: 'Invalid value for environment variable {varName}: {reason}',
  CONFIG_INVALID: 'Invalid configuration: {message}',

  // ─────────────────────────────────────────────────────────────────────────
  // Operation Errors
  // ─────────────────────────────────────────────────────────────────────────
  OPERATION_FAILED: "Operation '{operation}' failed",
  OPERATION_FAILED_REASON: "Operation '{operation}' failed: {reason}",
  OPERATION_CANCELLED: 'Request {requestId} was cancelled',
  OPERATION_CANCELLED_REASON: 'Request {requestId} was cancelled: {reason}',
  OPERATION_ABORTED: 'Operation aborted: {reason}',
  OPERATION_TIMEOUT: "Operation '{operation}' timed out after {timeoutMs}ms",
  OPERATION_UNAVAILABLE: "Operation '{operation}' is currently unavailable",
  OPERATION_NOT_SUPPORTED: "Operation '{operation}' is not supported",
  OPERATION_ALREADY_IN_PROGRESS: "Operation '{operation}' is already in progress",

  // ─────────────────────────────────────────────────────────────────────────
  // Connection Errors (generic)
  // ─────────────────────────────────────────────────────────────────────────
  CONNECTION_FAILED: 'Failed to connect to server',
  CONNECTION_REFUSED: 'Connection refused',
  CONNECTION_RESET: 'Connection was reset',
  CONNECTION_TIMEOUT: 'Connection timed out',
  CONNECTION_LOST: 'Connection lost',

  // ─────────────────────────────────────────────────────────────────────────
  // System/Internal Errors
  // ─────────────────────────────────────────────────────────────────────────
  INTERNAL_ERROR: 'An internal error occurred',
  INTERNAL_ERROR_WITH_ID: 'An internal error occurred (ref: {errorId})',
  INTERNAL_UNEXPECTED_STATE: 'Unexpected state: {description}',
  INTERNAL_NOT_IMPLEMENTED: "Feature '{feature}' is not implemented",
  UNEXPECTED_ERROR: 'An unexpected error occurred',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable',
  NOT_IMPLEMENTED: 'Feature not implemented',
  UNSUPPORTED_TRANSPORT: 'Unsupported transport type: {transport}',

  // ─────────────────────────────────────────────────────────────────────────
  // Registry Errors
  // ─────────────────────────────────────────────────────────────────────────
  REGISTRY_DUPLICATE: "{itemType} '{itemName}' is already registered",
  REGISTRY_NOT_FOUND: "{itemType} '{itemName}' not found",
  REGISTRY_TOOL_NOT_FOUND: "Tool '{name}' not found",
  REGISTRY_TOOL_DUPLICATE: "Tool '{name}' is already registered",
  REGISTRY_RESOURCE_NOT_FOUND: "Resource '{name}' not found",
  REGISTRY_RESOURCE_DUPLICATE: "Resource '{name}' is already registered",
  REGISTRY_PROMPT_NOT_FOUND: "Prompt '{name}' not found",
  REGISTRY_PROMPT_DUPLICATE: "Prompt '{name}' is already registered",
  TOOL_NOT_AVAILABLE: "Tool '{toolName}' is not available",

  // ─────────────────────────────────────────────────────────────────────────
  // Session Errors
  // ─────────────────────────────────────────────────────────────────────────
  SESSION_NOT_FOUND: "Session '{sessionId}' not found",
  SESSION_EXPIRED: "Session '{sessionId}' has expired",
  SESSION_LIMIT_REACHED: 'Session limit reached: maximum {maxSessions} sessions allowed',
  SESSION_INVALID_STATE: "Session '{sessionId}' is in invalid state '{currentState}', expected '{expectedState}'",

  // ─────────────────────────────────────────────────────────────────────────
  // Transport Errors
  // ─────────────────────────────────────────────────────────────────────────
  TRANSPORT_CONNECTION_FAILED: 'Connection failed: {reason}',
  TRANSPORT_CONNECTION_CLOSED: 'Connection closed',
  TRANSPORT_CONNECTION_CLOSED_REASON: 'Connection closed: {reason}',
  TRANSPORT_INVALID_HEADER: "Invalid header '{header}': {reason}",
  TRANSPORT_PROTOCOL_MISMATCH: "Protocol mismatch: expected '{expected}', received '{received}'",
  TRANSPORT_RATE_LIMITED: 'Rate limit exceeded',
  TRANSPORT_RATE_LIMITED_RETRY: 'Rate limit exceeded. Retry after {retryAfter} seconds',
  TRANSPORT_DNS_REBINDING: "DNS rebinding attack detected from host '{host}'",
} as const;

export type FrameworkMessageKey = keyof typeof FrameworkMessages;

// ============================================================================
// Message Interpolation
// ============================================================================

/**
 * Cached regex for template interpolation.
 * Pattern matches `{variableName}` placeholders.
 */
const INTERPOLATION_REGEX = /\{(\w+)\}/g;

/**
 * Interpolation parameters type.
 * Maps template variable names to their values.
 */
export type MessageParams = Record<string, string | number | boolean | undefined>;

/**
 * Get a framework message by key with optional interpolation.
 *
 * @param key - The message key
 * @param params - Optional parameters for interpolation
 * @returns The interpolated message string
 *
 * @example
 * ```typescript
 * // Simple message
 * getFrameworkMessage('MCP_SESSION_REQUIRED') // "Mcp-Session-Id header required"
 *
 * // With interpolation
 * getFrameworkMessage('OPERATION_CANCELLED', { operation: 'deploy' })
 * // "Operation 'deploy' was cancelled"
 * ```
 */
export function getFrameworkMessage(key: FrameworkMessageKey, params?: MessageParams): string {
  const template = FrameworkMessages[key];
  if (!params) {
    return template;
  }
  return interpolate(template, params);
}

/**
 * Interpolate a template string with parameters.
 *
 * @param template - The template string with `{variable}` placeholders
 * @param params - The parameters to interpolate
 * @returns The interpolated string
 *
 * @example
 * ```typescript
 * interpolate("Hello {name}!", { name: "World" })
 * // "Hello World!"
 * ```
 */
export function interpolate(template: string, params: MessageParams): string {
  // Reset lastIndex for global regex to ensure consistent matching
  INTERPOLATION_REGEX.lastIndex = 0;
  return template.replace(INTERPOLATION_REGEX, (match, key: string) => {
    const value = params[key];
    if (value === undefined) {
      return match; // Keep original placeholder if no value
    }
    return String(value);
  });
}

// ============================================================================
// Transport Error Message Mapping
// ============================================================================

/**
 * Transport-specific error messages mapped from FrameworkMessages.
 *
 * This provides a convenient API for transport layer code while
 * maintaining a single source of truth for all messages.
 *
 * @example
 * ```typescript
 * import { TransportErrorMessage } from './server/errors/index.js';
 *
 * res.status(HttpStatus.BAD_REQUEST)
 *    .json({ error: TransportErrorMessage.SESSION_ID_REQUIRED });
 * ```
 */
export const TransportErrorMessage = {
  // Session errors
  SESSION_ID_REQUIRED: FrameworkMessages.MCP_SESSION_REQUIRED,
  SESSION_ID_OR_PARAM_REQUIRED: FrameworkMessages.MCP_SESSION_REQUIRED,
  SESSION_NOT_FOUND: FrameworkMessages.MCP_SESSION_NOT_FOUND,
  SESSION_NOT_FOUND_REINIT: FrameworkMessages.MCP_SESSION_EXPIRED,
  TOO_MANY_SESSIONS: FrameworkMessages.MCP_TOO_MANY_SESSIONS,

  // Content errors
  MISSING_ACCEPT_HEADER: FrameworkMessages.MCP_MISSING_ACCEPT,
  INVALID_CONTENT_TYPE: FrameworkMessages.MCP_INVALID_CONTENT_TYPE,
  INVALID_JSON: FrameworkMessages.MCP_INVALID_JSON,
  INVALID_JSONRPC_VERSION: FrameworkMessages.MCP_INVALID_JSONRPC,
  MISSING_JSONRPC_METHOD: FrameworkMessages.MCP_MISSING_METHOD,
  INVALID_JSONRPC_BATCH: FrameworkMessages.MCP_INVALID_BATCH,

  // Transport state
  TRANSPORT_CLOSED: FrameworkMessages.MCP_TRANSPORT_CLOSED,

  // Generic
  INTERNAL_ERROR: FrameworkMessages.INTERNAL_ERROR,
} as const;

export type TransportErrorMessageKey = keyof typeof TransportErrorMessage;
