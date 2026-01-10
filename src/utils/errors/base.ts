/**
 * Base Error Classes for Komodo MCP Server
 *
 * Provides a hierarchy of custom error types for better error handling,
 * type safety, and consistent error responses across the application.
 *
 * @module errors/base
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Error codes used throughout the application.
 * Maps to both MCP ErrorCode and HTTP status codes where applicable.
 */
export const KomodoErrorCode = {
  // Client errors (4xx range conceptually)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Server errors (5xx range conceptually)
  API_ERROR: 'API_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Operation errors
  OPERATION_CANCELLED: 'OPERATION_CANCELLED',
  OPERATION_FAILED: 'OPERATION_FAILED',
} as const;

export type KomodoErrorCodeType = (typeof KomodoErrorCode)[keyof typeof KomodoErrorCode];

/**
 * Serializable error information for logging and API responses.
 */
export interface SerializedError {
  /** Error class name */
  name: string;
  /** Error message */
  message: string;
  /** Application-specific error code */
  code: KomodoErrorCodeType;
  /** HTTP status code (if applicable) */
  statusCode?: number;
  /** MCP error code (if applicable) */
  mcpCode?: ErrorCode;
  /** Stack trace (only in development) */
  stack?: string;
  /** Original error that caused this error */
  cause?: SerializedError | string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Base error class for all Komodo MCP Server errors.
 *
 * Features:
 * - Typed error codes for programmatic handling
 * - HTTP status code mapping for REST responses
 * - MCP error code mapping for JSON-RPC responses
 * - Error cause chain support
 * - Serialization for logging
 *
 * @example
 * ```typescript
 * throw new KomodoError('Something went wrong', {
 *   code: KomodoErrorCode.INTERNAL_ERROR,
 *   cause: originalError,
 *   context: { operation: 'listContainers' }
 * });
 * ```
 */
export class KomodoError extends Error {
  /** Application-specific error code */
  readonly code: KomodoErrorCodeType;

  /** HTTP status code for REST API responses */
  readonly statusCode: number;

  /** MCP error code for JSON-RPC responses */
  readonly mcpCode: ErrorCode;

  /** Additional context for debugging */
  readonly context?: Record<string, unknown>;

  /** Original error that caused this error */
  override readonly cause?: Error;

  constructor(
    message: string,
    options: {
      code?: KomodoErrorCodeType;
      statusCode?: number;
      mcpCode?: ErrorCode;
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code ?? KomodoErrorCode.INTERNAL_ERROR;
    this.statusCode = options.statusCode ?? 500;
    this.mcpCode = options.mcpCode ?? ErrorCode.InternalError;
    this.cause = options.cause;
    this.context = options.context;

    // Maintain proper stack trace in V8 environments
    /* v8 ignore start - V8-specific runtime feature */
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    /* v8 ignore stop */
  }

  /**
   * Serialize error for logging or API response.
   * Excludes stack trace in production for security.
   */
  toJSON(): SerializedError {
    const serialized: SerializedError = {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      mcpCode: this.mcpCode,
    };

    // Include stack in development only
    if (process.env.NODE_ENV !== 'production' && this.stack) {
      serialized.stack = this.stack;
    }

    // Serialize cause if present
    if (this.cause) {
      if (this.cause instanceof KomodoError) {
        serialized.cause = this.cause.toJSON();
      } else {
        serialized.cause = this.cause.message;
      }
    }

    // Include context if present
    if (this.context && Object.keys(this.context).length > 0) {
      serialized.context = this.context;
    }

    return serialized;
  }

  /**
   * Create a human-readable error message including cause chain.
   */
  toDetailedString(): string {
    let result = `${this.name} [${this.code}]: ${this.message}`;

    if (this.context) {
      result += ` | Context: ${JSON.stringify(this.context)}`;
    }

    if (this.cause) {
      if (this.cause instanceof KomodoError) {
        result += `\n  Caused by: ${this.cause.toDetailedString()}`;
      } else {
        result += `\n  Caused by: ${this.cause.message}`;
      }
    }

    return result;
  }

  /**
   * Check if an error is a KomodoError instance.
   */
  static isKomodoError(error: unknown): error is KomodoError {
    return error instanceof KomodoError;
  }

  /**
   * Wrap any error as a KomodoError.
   * If already a KomodoError, returns it unchanged.
   */
  static wrap(error: unknown, defaultMessage = 'An unexpected error occurred'): KomodoError {
    if (error instanceof KomodoError) {
      return error;
    }

    if (error instanceof Error) {
      return new KomodoError(error.message || defaultMessage, {
        cause: error,
        code: KomodoErrorCode.INTERNAL_ERROR,
      });
    }

    return new KomodoError(String(error) || defaultMessage, {
      code: KomodoErrorCode.INTERNAL_ERROR,
    });
  }
}
