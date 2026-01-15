/**
 * Base Error Class Module
 *
 * Provides the foundational AppError class that all application errors
 * extend from. Features include:
 *
 * - Unique error ID for tracking and support
 * - Typed error codes for programmatic handling
 * - HTTP status code mapping for REST responses
 * - MCP error code mapping for JSON-RPC responses
 * - Recovery hints for user guidance
 * - Error cause chain support
 * - Serialization for logging
 * - Environment-aware stack traces
 *
 * @module server/errors/core/base
 */

import { randomUUID } from 'node:crypto';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCodes, type ErrorCodeType } from './error-codes.js';
import { ErrorCodeToHttpStatus } from './http.js';
import type { BaseErrorOptions, SerializedError } from './types.js';

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all MCP Server errors.
 *
 * All application errors should extend this class or one of its
 * specialized subclasses. Provides consistent error handling,
 * serialization, and integration with MCP/HTTP error codes.
 *
 * @example
 * ```typescript
 * throw new AppError('Something went wrong', {
 *   code: ErrorCodes.INTERNAL_ERROR,
 *   cause: originalError,
 *   context: { operation: 'listContainers' },
 *   recoveryHint: 'Try again later or check the server status'
 * });
 * ```
 */
export class AppError extends Error {
  /** Unique identifier for this error instance (for tracking/support) */
  readonly errorId: string;

  /** Application-specific error code */
  readonly code: ErrorCodeType;

  /** HTTP status code for REST API responses */
  readonly statusCode: number;

  /** MCP error code for JSON-RPC responses */
  readonly mcpCode: ErrorCode;

  /** Additional context for debugging */
  readonly context?: Record<string, unknown>;

  /** Original error that caused this error */
  override readonly cause?: Error;

  /** Timestamp when the error occurred */
  readonly timestamp: Date;

  /** Recovery hint for users - guidance on how to resolve the error */
  readonly recoveryHint?: string;

  constructor(message: string, options: BaseErrorOptions = {}) {
    super(message);
    this.name = this.constructor.name;
    this.errorId = randomUUID();
    this.code = options.code ?? ErrorCodes.INTERNAL_ERROR;
    this.statusCode = options.statusCode ?? ErrorCodeToHttpStatus[this.code] ?? 500;
    this.mcpCode = options.mcpCode ?? ErrorCode.InternalError;
    this.cause = options.cause;
    this.context = options.context;
    this.timestamp = new Date();
    this.recoveryHint = options.recoveryHint;

    // Maintain proper stack trace in V8 environments
    /* v8 ignore start - V8-specific runtime feature */
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    /* v8 ignore stop */
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Serialize error for logging or API response.
   * Excludes stack trace in production for security.
   *
   * @returns Serialized error object
   */
  toJSON(): SerializedError {
    const serialized: SerializedError = {
      name: this.name,
      message: this.message,
      errorId: this.errorId,
      code: this.code,
      statusCode: this.statusCode,
      mcpCode: this.mcpCode,
      timestamp: this.timestamp.toISOString(),
    };

    // Include stack in development only
    if (process.env.NODE_ENV !== 'production' && this.stack) {
      serialized.stack = this.stack;
    }

    // Serialize cause if present
    if (this.cause) {
      if (this.cause instanceof AppError) {
        serialized.cause = this.cause.toJSON();
      } else {
        serialized.cause = this.cause.message;
      }
    }

    // Include context if present
    if (this.context && Object.keys(this.context).length > 0) {
      serialized.context = this.context;
    }

    // Include recovery hint if present
    if (this.recoveryHint) {
      serialized.recoveryHint = this.recoveryHint;
    }

    return serialized;
  }

  /**
   * Create a human-readable error message including cause chain.
   *
   * @returns Detailed error string with cause chain
   */
  toDetailedString(): string {
    let result = `${this.name} [${this.code}] (${this.errorId}): ${this.message}`;

    if (this.recoveryHint) {
      result += ` | Hint: ${this.recoveryHint}`;
    }

    if (this.context && Object.keys(this.context).length > 0) {
      result += ` | Context: ${JSON.stringify(this.context)}`;
    }

    if (this.cause) {
      if (this.cause instanceof AppError) {
        result += `\n  Caused by: ${this.cause.toDetailedString()}`;
      } else {
        result += `\n  Caused by: ${this.cause.message}`;
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Static Utilities
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Type guard to check if an error is a AppError instance.
   *
   * @param error - The error to check
   * @returns True if error is a AppError
   */
  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }

  /**
   * Wrap any error as a AppError.
   * If already a AppError, returns it unchanged.
   *
   * @param error - The error to wrap
   * @param defaultMessage - Message to use if error has none
   * @returns A AppError instance
   */
  static wrap(error: unknown, defaultMessage = 'An unexpected error occurred'): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(error.message || defaultMessage, {
        cause: error,
        code: ErrorCodes.INTERNAL_ERROR,
      });
    }

    return new AppError(String(error) || defaultMessage, {
      code: ErrorCodes.INTERNAL_ERROR,
    });
  }

  /**
   * Create a AppError from an unknown error, preserving type if already AppError.
   * Useful for catch blocks where you want to re-throw with additional context.
   *
   * @param error - The error to wrap
   * @param context - Additional context to add
   * @returns A AppError with merged context
   */
  static wrapWithContext(error: unknown, context: Record<string, unknown>): AppError {
    const wrappedError = AppError.wrap(error);

    // Merge context and preserve recoveryHint
    return new AppError(wrappedError.message, {
      code: wrappedError.code,
      statusCode: wrappedError.statusCode,
      mcpCode: wrappedError.mcpCode,
      cause: wrappedError.cause,
      context: { ...wrappedError.context, ...context },
      recoveryHint: wrappedError.recoveryHint,
    });
  }

  /**
   * Check if an error is a cancellation error.
   * Handles both OperationCancelledError and native AbortError.
   *
   * @param error - The error to check
   * @returns True if error represents a cancellation
   */
  static isCancellation(error: unknown): boolean {
    if (error instanceof Error) {
      // Check for AbortError (from AbortController)
      if (error.name === 'AbortError') {
        return true;
      }
      // Check for our cancellation code
      if (error instanceof AppError && error.code === ErrorCodes.OPERATION_CANCELLED) {
        return true;
      }
    }
    return false;
  }
}
