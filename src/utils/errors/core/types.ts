/**
 * Error Type Definitions
 *
 * Central type definitions for the error system including:
 * - Error codes enum (application-specific)
 * - Serialization interfaces
 * - Error category types
 *
 * @module errors/core/types
 */

import type { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Application-specific error codes.
 *
 * Organized by category:
 * - CLIENT_* (4xx range): Client/input errors
 * - SERVER_* (5xx range): Server/internal errors
 * - OPERATION_*: Operation lifecycle errors
 */
export const ErrorCodes = {
  // ─────────────────────────────────────────────────────────────────────────
  // Client Errors (4xx conceptually)
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
  // Server/API Errors (5xx conceptually)
  // ─────────────────────────────────────────────────────────────────────────
  /** Komodo API communication error */
  API_ERROR: 'API_ERROR',
  /** Network connection failed */
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  /** Request timeout */
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  /** Internal server error */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** Service unavailable */
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // ─────────────────────────────────────────────────────────────────────────
  // Operation Errors
  // ─────────────────────────────────────────────────────────────────────────
  /** Operation was cancelled */
  OPERATION_CANCELLED: 'OPERATION_CANCELLED',
  /** Operation failed */
  OPERATION_FAILED: 'OPERATION_FAILED',
  /** Client not configured */
  CLIENT_NOT_CONFIGURED: 'CLIENT_NOT_CONFIGURED',
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

// ============================================================================
// HTTP Status Code Mapping
// ============================================================================

/**
 * Maps error codes to HTTP status codes.
 */
export const ErrorCodeToHttpStatus: Record<ErrorCodeType, number> = {
  // Client errors (4xx)
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.INVALID_REQUEST]: 400,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.NOT_FOUND]: 404,

  // Server errors (5xx)
  [ErrorCodes.CONFIGURATION_ERROR]: 500,
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.API_ERROR]: 502,
  [ErrorCodes.CONNECTION_ERROR]: 503,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.TIMEOUT_ERROR]: 504,

  // Operation errors
  [ErrorCodes.OPERATION_CANCELLED]: 499,
  [ErrorCodes.OPERATION_FAILED]: 500,
  [ErrorCodes.CLIENT_NOT_CONFIGURED]: 503,
};

// ============================================================================
// Serialization Types
// ============================================================================

/**
 * Serializable error information for logging and API responses.
 */
export interface SerializedError {
  /** Error class name */
  name: string;
  /** Human-readable error message */
  message: string;
  /** Unique error ID for tracking/support */
  errorId: string;
  /** Application-specific error code */
  code: ErrorCodeType;
  /** HTTP status code (if applicable) */
  statusCode?: number;
  /** MCP error code (if applicable) */
  mcpCode?: ErrorCode;
  /** Stack trace (development only) */
  stack?: string;
  /** Original error that caused this error */
  cause?: SerializedError | string;
  /** Additional context for debugging */
  context?: Record<string, unknown>;
  /** Timestamp of error occurrence */
  timestamp?: string;
  /** Recovery hint for users */
  recoveryHint?: string;
}

// ============================================================================
// Error Options Types
// ============================================================================

/**
 * Base options for creating errors.
 */
export interface BaseErrorOptions {
  /** Application error code */
  code?: ErrorCodeType;
  /** HTTP status code override */
  statusCode?: number;
  /** MCP error code override */
  mcpCode?: ErrorCode;
  /** Original error that caused this */
  cause?: Error;
  /** Additional context for debugging */
  context?: Record<string, unknown>;
  /** Recovery hint for users */
  recoveryHint?: string;
}

/**
 * Options for API errors.
 */
export interface ApiErrorOptions extends Omit<BaseErrorOptions, 'code'> {
  /** The API endpoint that was called */
  endpoint?: string;
  /** The HTTP method used */
  method?: string;
  /** Response status code from the API */
  responseStatus?: number;
}

/**
 * Options for connection errors.
 */
export interface ConnectionErrorOptions extends Omit<BaseErrorOptions, 'code'> {
  /** The URL that was attempted */
  url?: string;
  /** Whether this is a timeout */
  isTimeout?: boolean;
}

/**
 * Options for validation errors.
 */
export interface ValidationErrorOptions extends Omit<BaseErrorOptions, 'code'> {
  /** The field that failed validation */
  field?: string;
  /** The invalid value (will be sanitized) */
  value?: unknown;
  /** All validation issues */
  issues?: ValidationIssue[];
}

/**
 * A single validation issue.
 */
export interface ValidationIssue {
  /** Path to the invalid field (e.g., 'config.port') */
  path: string;
  /** Human-readable error message */
  message: string;
  /** Validation error code */
  code: string;
}

/**
 * Options for operation errors.
 */
export interface OperationErrorOptions extends Omit<BaseErrorOptions, 'code'> {
  /** The operation that failed */
  operation?: string;
}
