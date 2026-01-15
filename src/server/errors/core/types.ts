/**
 * Error Type Definitions
 *
 * Pure TypeScript type definitions for the error system.
 * Contains only interfaces and type aliases - no runtime values.
 *
 * @module server/errors/core/types
 */

import type { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ErrorCodeType } from './index.js';

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
 * Options for validation errors.
 */
export interface ValidationErrorOptions extends Omit<BaseErrorOptions, 'code'> {
  /** The field that failed validation */
  field?: string;
  /** The value that failed validation (will be sanitized) */
  value?: unknown;
  /** Expected type or format */
  expected?: string;
  /** Multiple validation issues */
  issues?: ValidationIssue[];
}

/**
 * Validation issue for multi-field validation.
 */
export interface ValidationIssue {
  /** Path to the invalid field */
  path: string;
  /** Error message for this issue */
  message: string;
  /** Zod error code */
  code?: string;
}

// ============================================================================
// Re-export Error Code Types for convenience
// ============================================================================

export type { ErrorCodeType, ErrorCategoryType } from './error-codes.js';
