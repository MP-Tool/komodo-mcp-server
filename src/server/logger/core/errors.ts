/**
 * Logger Error Classes Module
 *
 * Provides typed error classes for the logging system with a clean
 * hierarchy that doesn't depend on external error modules.
 *
 * @module logger/core/errors
 */

// ============================================================================
// Logger Error Codes
// ============================================================================

/**
 * Logger-specific error codes.
 */
export const LoggerErrorCode = {
  /** Generic logger error */
  LOGGER_ERROR: 'LOGGER_ERROR',
  /** Logger resource initialization failed */
  LOGGER_INIT_ERROR: 'LOGGER_INIT_ERROR',
  /** Context depth exceeded */
  CONTEXT_DEPTH_EXCEEDED: 'CONTEXT_DEPTH_EXCEEDED',
  /** Writer operation failed */
  WRITER_ERROR: 'WRITER_ERROR',
  /** Formatter operation failed */
  FORMATTER_ERROR: 'FORMATTER_ERROR',
  /** Scrubbing operation failed */
  SCRUBBER_ERROR: 'SCRUBBER_ERROR',
} as const;

export type LoggerErrorCodeType = (typeof LoggerErrorCode)[keyof typeof LoggerErrorCode];

// ============================================================================
// Base Logger Error
// ============================================================================

/**
 * Base error class for all logger-related errors.
 *
 * Features:
 * - Typed error codes for programmatic handling
 * - Error cause chain support
 * - Additional context for debugging
 * - Serialization for logging
 *
 * @example
 * ```typescript
 * throw new LoggerError('Failed to initialize logger', {
 *   code: LoggerErrorCode.LOGGER_INIT_ERROR,
 *   cause: originalError,
 *   context: { format: 'json' }
 * });
 * ```
 */
export class LoggerError extends Error {
  /** Error code for programmatic handling */
  readonly code: LoggerErrorCodeType;

  /** Additional context for debugging */
  readonly context?: Record<string, unknown>;

  /** Original error that caused this error */
  override readonly cause?: Error;

  constructor(
    message: string,
    options: {
      code?: LoggerErrorCodeType;
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = 'LoggerError';
    this.code = options.code ?? LoggerErrorCode.LOGGER_ERROR;
    this.cause = options.cause;
    this.context = options.context;

    // Maintain proper stack trace in V8 environments
    /* v8 ignore start */
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    /* v8 ignore stop */
  }

  /**
   * Serialize error for logging.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      cause: this.cause?.message,
      stack: process.env.NODE_ENV !== 'production' ? this.stack : undefined,
    };
  }

  /**
   * Check if an error is a LoggerError instance.
   */
  static isLoggerError(error: unknown): error is LoggerError {
    return error instanceof LoggerError;
  }
}

// ============================================================================
// Specialized Logger Errors
// ============================================================================

/**
 * Error thrown when logger resources fail to initialize.
 */
export class LoggerInitError extends LoggerError {
  constructor(
    message: string,
    options: {
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      code: LoggerErrorCode.LOGGER_INIT_ERROR,
      cause: options.cause,
      context: options.context,
    });
    this.name = 'LoggerInitError';
  }
}

/**
 * Error thrown when context nesting depth is exceeded.
 */
export class ContextDepthError extends LoggerError {
  readonly maxDepth: number;
  readonly currentDepth: number;

  constructor(maxDepth: number, currentDepth?: number) {
    super(`Maximum context depth (${maxDepth}) exceeded. Possible infinite recursion.`, {
      code: LoggerErrorCode.CONTEXT_DEPTH_EXCEEDED,
      context: { maxDepth, currentDepth },
    });
    this.name = 'ContextDepthError';
    this.maxDepth = maxDepth;
    this.currentDepth = currentDepth ?? maxDepth + 1;
  }
}

/**
 * Error thrown when a log writer operation fails.
 */
export class WriterError extends LoggerError {
  readonly writerName: string;

  constructor(
    writerName: string,
    message: string,
    options: {
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      code: LoggerErrorCode.WRITER_ERROR,
      cause: options.cause,
      context: { ...options.context, writerName },
    });
    this.name = 'WriterError';
    this.writerName = writerName;
  }
}

/**
 * Error thrown when log formatting fails.
 */
export class FormatterError extends LoggerError {
  readonly formatterName: string;

  constructor(
    formatterName: string,
    message: string,
    options: {
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      code: LoggerErrorCode.FORMATTER_ERROR,
      cause: options.cause,
      context: { ...options.context, formatterName },
    });
    this.name = 'FormatterError';
    this.formatterName = formatterName;
  }
}

/**
 * Error thrown when secret scrubbing fails.
 */
export class ScrubberError extends LoggerError {
  constructor(
    message: string,
    options: {
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      code: LoggerErrorCode.SCRUBBER_ERROR,
      cause: options.cause,
      context: options.context,
    });
    this.name = 'ScrubberError';
  }
}
