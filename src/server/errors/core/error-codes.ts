/**
 * Application Error Codes Module
 *
 * Defines application-specific error codes and categories.
 * These are semantic error identifiers used throughout the application
 * for programmatic error handling.
 *
 * @module server/errors/core/error-codes
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Application-specific error codes.
 *
 * Organized by category:
 * - Framework errors (generic MCP framework)
 * - Generic App errors
 */
export const ErrorCodes = {
  // ─────────────────────────────────────────────────────────────────────────
  // Framework - Client Errors (4xx conceptually)
  // ─────────────────────────────────────────────────────────────────────────
  /** Input validation failed */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** Configuration is invalid or missing */
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  /** Requested resource not found */
  NOT_FOUND: 'NOT_FOUND',
  /** Authentication failed */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** Access denied */
  FORBIDDEN: 'FORBIDDEN',
  /** Invalid request format */
  INVALID_REQUEST: 'INVALID_REQUEST',

  // ─────────────────────────────────────────────────────────────────────────
  // Framework - Server/API Errors (5xx conceptually)
  // ─────────────────────────────────────────────────────────────────────────
  /** API communication error */
  API_ERROR: 'API_ERROR',
  /** Network connection failed */
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  /** Request timeout */
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  /** Internal server error */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** Service unavailable */
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  /** Registry error (tool/resource/prompt) */
  REGISTRY_ERROR: 'REGISTRY_ERROR',

  // ─────────────────────────────────────────────────────────────────────────
  // Framework - Operation Errors
  // ─────────────────────────────────────────────────────────────────────────
  /** Operation was cancelled */
  OPERATION_CANCELLED: 'OPERATION_CANCELLED',
  /** Operation failed */
  OPERATION_ERROR: 'OPERATION_ERROR',

  // ─────────────────────────────────────────────────────────────────────────
  // Additional App-specific Errors
  // ─────────────────────────────────────────────────────────────────────────
  /** Client not configured */
  API_CLIENT_NOT_CONFIGURED: 'API_CLIENT_NOT_CONFIGURED',
  /** Authentication error */
  API_AUTHENTICATION_ERROR: 'API_AUTHENTICATION_ERROR',
} as const;

export type ErrorCodeType = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================================================
// Error Categories
// ============================================================================

/**
 * Error categories for grouping and handling.
 */
export const ErrorCategory = {
  /** API communication errors */
  API: 'api',
  /** MCP protocol errors */
  MCP: 'mcp',
  /** Input validation errors */
  VALIDATION: 'validation',
  /** Configuration errors */
  CONFIGURATION: 'configuration',
  /** Connection/network errors */
  CONNECTION: 'connection',
  /** Operation lifecycle errors */
  OPERATION: 'operation',
  /** Internal system errors */
  SYSTEM: 'system',
} as const;

export type ErrorCategoryType = (typeof ErrorCategory)[keyof typeof ErrorCategory];
