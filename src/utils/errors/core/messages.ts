/**
 * Error Messages Module
 *
 * Centralized message registry with interpolation support for:
 * - API error messages
 * - MCP error messages
 * - Connection error messages
 * - System error messages
 * - Validation error messages
 *
 * ## Design Principles
 *
 * 1. **Standard Messages**: Use predefined messages for consistency
 * 2. **Custom Messages**: Allowed only where contextual information is essential
 * 3. **Interpolation**: Support for dynamic values via template syntax
 * 4. **Categorization**: Messages grouped by error category
 *
 * @example
 * ```typescript
 * import { getMessage, MessageKey } from './messages.js';
 *
 * // Get a standard message
 * const msg = getMessage('API_REQUEST_FAILED');
 *
 * // Get a message with interpolation
 * const msg = getMessage('RESOURCE_NOT_FOUND', {
 *   resourceType: 'Server',
 *   resourceId: 'my-server'
 * });
 * ```
 *
 * @module errors/core/messages
 */

// ============================================================================
// Message Definitions
// ============================================================================

/**
 * Error message definitions organized by category.
 *
 * Template syntax: `{variableName}` for interpolation
 */
export const ErrorMessages = {
  // ─────────────────────────────────────────────────────────────────────────
  // API Errors
  // ─────────────────────────────────────────────────────────────────────────
  API_REQUEST_FAILED: 'API request failed',
  API_REQUEST_FAILED_WITH_STATUS: 'API request failed with status {status}',
  API_ENDPOINT_ERROR: 'Error calling {endpoint}: {message}',
  API_RESPONSE_INVALID: 'Invalid response from API',
  API_RESPONSE_PARSE_ERROR: 'Failed to parse API response',

  // ─────────────────────────────────────────────────────────────────────────
  // Authentication Errors
  // ─────────────────────────────────────────────────────────────────────────
  AUTH_FAILED: 'Authentication failed',
  AUTH_INVALID_CREDENTIALS: 'Invalid username or password',
  AUTH_TOKEN_EXPIRED: 'Authentication token has expired',
  AUTH_TOKEN_MISSING: 'Authentication token is missing',
  AUTH_TOKEN_INVALID: 'Invalid authentication token',
  AUTH_LOGIN_FAILED: 'Login failed: {status} {statusText}',
  AUTH_NO_TOKEN: 'Login successful but no JWT token received',

  // ─────────────────────────────────────────────────────────────────────────
  // Connection Errors
  // ─────────────────────────────────────────────────────────────────────────
  CONNECTION_FAILED: 'Failed to connect to server',
  CONNECTION_FAILED_URL: 'Failed to connect to {url}',
  CONNECTION_REFUSED: 'Connection refused',
  CONNECTION_RESET: 'Connection was reset',
  CONNECTION_TIMEOUT: 'Connection timed out',
  CONNECTION_TIMEOUT_MS: 'Connection timed out after {timeout}ms',
  CONNECTION_LOST: 'Connection lost',
  CONNECTION_DNS_FAILED: 'DNS lookup failed for {host}',
  CONNECTION_HEALTH_CHECK_FAILED: 'Health check failed: {reason}',

  // ─────────────────────────────────────────────────────────────────────────
  // Resource Errors
  // ─────────────────────────────────────────────────────────────────────────
  RESOURCE_NOT_FOUND: "{resourceType} '{resourceId}' not found",
  RESOURCE_ALREADY_EXISTS: "{resourceType} '{resourceId}' already exists",
  RESOURCE_ACCESS_DENIED: "Access denied to {resourceType} '{resourceId}'",
  SERVER_NOT_FOUND: "Server '{serverId}' not found",
  CONTAINER_NOT_FOUND: "Container '{containerId}' not found",
  STACK_NOT_FOUND: "Stack '{stackId}' not found",
  DEPLOYMENT_NOT_FOUND: "Deployment '{deploymentId}' not found",

  // ─────────────────────────────────────────────────────────────────────────
  // Client/Configuration Errors
  // ─────────────────────────────────────────────────────────────────────────
  CLIENT_NOT_CONFIGURED: 'Komodo client not initialized. Use komodo_configure first.',
  CLIENT_NOT_CONFIGURED_TOOL: "Tool '{toolName}' requires a Komodo connection. Use 'komodo_configure' first.",
  CONFIG_MISSING_ENV: 'Missing required environment variable: {varName}',
  CONFIG_INVALID_ENV: 'Invalid value for environment variable {varName}: {reason}',
  CONFIG_INVALID: 'Invalid configuration: {message}',

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
  // Operation Errors
  // ─────────────────────────────────────────────────────────────────────────
  OPERATION_FAILED: 'Operation failed',
  OPERATION_FAILED_NAMED: "Operation '{operation}' failed",
  OPERATION_FAILED_WITH_REASON: "Operation '{operation}' failed: {reason}",
  OPERATION_CANCELLED: "Operation '{operation}' was cancelled",
  OPERATION_TIMEOUT: "Operation '{operation}' timed out",
  OPERATION_NOT_SUPPORTED: "Operation '{operation}' is not supported",
  OPERATION_ALREADY_IN_PROGRESS: "Operation '{operation}' is already in progress",

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
  // System/Internal Errors
  // ─────────────────────────────────────────────────────────────────────────
  INTERNAL_ERROR: 'An internal error occurred',
  INTERNAL_ERROR_WITH_ID: 'An internal error occurred (ref: {errorId})',
  UNEXPECTED_ERROR: 'An unexpected error occurred',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable',
  NOT_IMPLEMENTED: 'Feature not implemented',
  UNSUPPORTED_TRANSPORT: 'Unsupported transport type: {transport}',

  // ─────────────────────────────────────────────────────────────────────────
  // Registry Errors
  // ─────────────────────────────────────────────────────────────────────────
  REGISTRY_DUPLICATE: "{itemType} '{itemName}' is already registered",
  REGISTRY_NOT_FOUND: "{itemType} '{itemName}' not found",
  TOOL_NOT_AVAILABLE: "Tool '{toolName}' is not available",
  TOOL_REQUIRES_CONNECTION: "Tool '{toolName}' requires a Komodo connection",
} as const;

export type MessageKey = keyof typeof ErrorMessages;

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
 * Get a message by key with optional interpolation.
 *
 * @param key - The message key
 * @param params - Optional parameters for interpolation
 * @returns The interpolated message string
 *
 * @example
 * ```typescript
 * // Simple message
 * getMessage('AUTH_FAILED') // "Authentication failed"
 *
 * // With interpolation
 * getMessage('RESOURCE_NOT_FOUND', {
 *   resourceType: 'Server',
 *   resourceId: 'my-server'
 * }) // "Server 'my-server' not found"
 * ```
 */
export function getMessage(key: MessageKey, params?: MessageParams): string {
  const template = ErrorMessages[key];
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
// Message Categories (for documentation/tooling)
// ============================================================================

/**
 * Group messages by category for easier navigation.
 */
export const MessageCategories = {
  api: [
    'API_REQUEST_FAILED',
    'API_REQUEST_FAILED_WITH_STATUS',
    'API_ENDPOINT_ERROR',
    'API_RESPONSE_INVALID',
    'API_RESPONSE_PARSE_ERROR',
  ],
  auth: [
    'AUTH_FAILED',
    'AUTH_INVALID_CREDENTIALS',
    'AUTH_TOKEN_EXPIRED',
    'AUTH_TOKEN_MISSING',
    'AUTH_TOKEN_INVALID',
    'AUTH_LOGIN_FAILED',
    'AUTH_NO_TOKEN',
  ],
  connection: [
    'CONNECTION_FAILED',
    'CONNECTION_FAILED_URL',
    'CONNECTION_REFUSED',
    'CONNECTION_RESET',
    'CONNECTION_TIMEOUT',
    'CONNECTION_TIMEOUT_MS',
    'CONNECTION_LOST',
    'CONNECTION_DNS_FAILED',
    'CONNECTION_HEALTH_CHECK_FAILED',
  ],
  resource: [
    'RESOURCE_NOT_FOUND',
    'RESOURCE_ALREADY_EXISTS',
    'RESOURCE_ACCESS_DENIED',
    'SERVER_NOT_FOUND',
    'CONTAINER_NOT_FOUND',
    'STACK_NOT_FOUND',
    'DEPLOYMENT_NOT_FOUND',
  ],
  config: [
    'CLIENT_NOT_CONFIGURED',
    'CLIENT_NOT_CONFIGURED_TOOL',
    'CONFIG_MISSING_ENV',
    'CONFIG_INVALID_ENV',
    'CONFIG_INVALID',
  ],
  validation: [
    'VALIDATION_FAILED',
    'VALIDATION_FIELD_REQUIRED',
    'VALIDATION_FIELD_INVALID',
    'VALIDATION_FIELD_TYPE',
    'VALIDATION_FIELD_MIN',
    'VALIDATION_FIELD_MAX',
    'VALIDATION_FIELD_PATTERN',
  ],
  operation: [
    'OPERATION_FAILED',
    'OPERATION_FAILED_NAMED',
    'OPERATION_FAILED_WITH_REASON',
    'OPERATION_CANCELLED',
    'OPERATION_TIMEOUT',
    'OPERATION_NOT_SUPPORTED',
    'OPERATION_ALREADY_IN_PROGRESS',
  ],
  mcp: [
    'MCP_SESSION_REQUIRED',
    'MCP_SESSION_NOT_FOUND',
    'MCP_SESSION_EXPIRED',
    'MCP_TOO_MANY_SESSIONS',
    'MCP_INVALID_CONTENT_TYPE',
    'MCP_INVALID_JSON',
    'MCP_INVALID_JSONRPC',
    'MCP_MISSING_METHOD',
    'MCP_INVALID_BATCH',
    'MCP_TRANSPORT_CLOSED',
    'MCP_TRANSPORT_NOT_STARTED',
    'MCP_REQUEST_CANCELLED',
    'MCP_MISSING_ACCEPT',
  ],
  system: [
    'INTERNAL_ERROR',
    'INTERNAL_ERROR_WITH_ID',
    'UNEXPECTED_ERROR',
    'SERVICE_UNAVAILABLE',
    'NOT_IMPLEMENTED',
    'UNSUPPORTED_TRANSPORT',
  ],
  registry: ['REGISTRY_DUPLICATE', 'REGISTRY_NOT_FOUND', 'TOOL_NOT_AVAILABLE', 'TOOL_REQUIRES_CONNECTION'],
} as const satisfies Record<string, readonly MessageKey[]>;

export type MessageCategoryType = keyof typeof MessageCategories;

// ============================================================================
// Transport Error Message Mapping
// ============================================================================

/**
 * Transport-specific error messages mapped from ErrorMessages.
 *
 * This provides a convenient API for transport layer code while
 * maintaining a single source of truth for all messages.
 *
 * @example
 * ```typescript
 * import { TransportErrorMessage } from '../utils/errors/index.js';
 *
 * res.status(HttpStatus.BAD_REQUEST)
 *    .json({ error: TransportErrorMessage.SESSION_ID_REQUIRED });
 * ```
 */
export const TransportErrorMessage = {
  // Session errors
  SESSION_ID_REQUIRED: ErrorMessages.MCP_SESSION_REQUIRED,
  SESSION_ID_OR_PARAM_REQUIRED: ErrorMessages.MCP_SESSION_REQUIRED,
  SESSION_NOT_FOUND: ErrorMessages.MCP_SESSION_NOT_FOUND,
  SESSION_NOT_FOUND_REINIT: ErrorMessages.MCP_SESSION_EXPIRED,
  TOO_MANY_SESSIONS: ErrorMessages.MCP_TOO_MANY_SESSIONS,

  // Content errors
  MISSING_ACCEPT_HEADER: ErrorMessages.MCP_MISSING_ACCEPT,
  INVALID_CONTENT_TYPE: ErrorMessages.MCP_INVALID_CONTENT_TYPE,
  INVALID_JSON: ErrorMessages.MCP_INVALID_JSON,
  INVALID_JSONRPC_VERSION: ErrorMessages.MCP_INVALID_JSONRPC,
  MISSING_JSONRPC_METHOD: ErrorMessages.MCP_MISSING_METHOD,
  INVALID_JSONRPC_BATCH: ErrorMessages.MCP_INVALID_BATCH,

  // Transport state
  TRANSPORT_CLOSED: ErrorMessages.MCP_TRANSPORT_CLOSED,

  // Generic
  INTERNAL_ERROR: ErrorMessages.INTERNAL_ERROR,
} as const;

export type TransportErrorMessageKey = keyof typeof TransportErrorMessage;
