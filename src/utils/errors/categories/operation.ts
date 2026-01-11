/**
 * Operation Error Classes
 *
 * Errors related to tool/resource operations:
 * - OperationError: Generic operation failures
 * - OperationCancelledError: Cancelled operations
 * - ClientNotConfiguredError: Missing client connection
 *
 * @module errors/categories/operation
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AppError } from '../core/base.js';
import { ErrorCodes, type OperationErrorOptions, type BaseErrorOptions } from '../core/types.js';
import { getMessage } from '../core/messages.js';
import { JsonRpcErrorCode } from '../core/constants.js';

// ============================================================================
// Operation Cancelled Error
// ============================================================================

/**
 * Error thrown when an operation is cancelled.
 *
 * @example
 * ```typescript
 * if (signal.aborted) {
 *   throw new OperationCancelledError('listContainers');
 * }
 * ```
 */
export class OperationCancelledError extends AppError {
  /** The operation that was cancelled */
  readonly operation: string;

  constructor(operation: string, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(getMessage('OPERATION_CANCELLED', { operation }), {
      code: ErrorCodes.OPERATION_CANCELLED,
      statusCode: 499, // Client Closed Request (nginx convention)
      mcpCode: JsonRpcErrorCode.REQUEST_CANCELLED as unknown as ErrorCode,
      cause: options.cause,
      recoveryHint: options.recoveryHint ?? 'The operation was cancelled. Retry if needed.',
      context: {
        ...options.context,
        operation,
      },
    });

    this.operation = operation;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Static Utilities
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if an error is a cancellation error (either OperationCancelledError or AbortError).
   */
  static isCancellation(error: unknown): boolean {
    if (error instanceof OperationCancelledError) {
      return true;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return true;
    }
    return false;
  }
}

// ============================================================================
// Operation Error
// ============================================================================

/**
 * Error thrown when an operation fails.
 *
 * @example
 * ```typescript
 * throw new OperationError('startContainer', 'Container is already running', {
 *   context: { container: 'nginx', server: 'my-server' }
 * });
 *
 * // Using factory methods
 * throw OperationError.failed('startContainer', 'Container is already running');
 * ```
 */
export class OperationError extends AppError {
  /** The operation that failed */
  readonly operation: string;

  constructor(operation: string, message: string, options: OperationErrorOptions = {}) {
    super(message, {
      code: ErrorCodes.OPERATION_FAILED,
      statusCode: options.statusCode ?? 500,
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        operation,
      },
    });

    this.operation = operation;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an OperationError for a failed operation with reason.
   */
  static failed(operation: string, reason: string): OperationError {
    return new OperationError(operation, getMessage('OPERATION_FAILED_WITH_REASON', { operation, reason }), {
      recoveryHint: 'Check the operation parameters and retry.',
    });
  }

  /**
   * Create an OperationError for a generic operation failure.
   */
  static generic(operation: string): OperationError {
    return new OperationError(operation, getMessage('OPERATION_FAILED_NAMED', { operation }), {
      recoveryHint: 'Check the operation parameters and server status, then retry.',
    });
  }

  /**
   * Create an OperationError for a timeout.
   */
  static timeout(operation: string): OperationError {
    return new OperationError(operation, getMessage('OPERATION_TIMEOUT', { operation }), {
      recoveryHint: 'The operation took too long. Check server load and try again.',
    });
  }

  /**
   * Create an OperationError for unsupported operation.
   */
  static notSupported(operation: string): OperationError {
    return new OperationError(operation, getMessage('OPERATION_NOT_SUPPORTED', { operation }), {
      recoveryHint: 'This operation is not supported. Check the documentation for alternatives.',
    });
  }
}

// ============================================================================
// Client Not Configured Error
// ============================================================================

/**
 * Error thrown when a tool requires a Komodo connection but none is available.
 *
 * @example
 * ```typescript
 * if (!client) {
 *   throw new ClientNotConfiguredError('listContainers');
 * }
 * ```
 */
export class ClientNotConfiguredError extends AppError {
  /** The tool that requires a client */
  readonly tool: string;

  constructor(tool: string, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(getMessage('CLIENT_NOT_CONFIGURED_TOOL', { toolName: tool }), {
      code: ErrorCodes.CLIENT_NOT_CONFIGURED,
      statusCode: 503, // Service Unavailable
      mcpCode: ErrorCode.InvalidRequest,
      recoveryHint: options.recoveryHint ?? 'Use komodo_configure to connect to a Komodo server first.',
      context: {
        ...options.context,
        tool,
      },
    });

    this.tool = tool;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a generic "not configured" error without tool context.
   */
  static generic(): ClientNotConfiguredError {
    // Create with empty tool name but use the generic message
    const error = new ClientNotConfiguredError('');
    // Override the message
    Object.defineProperty(error, 'message', {
      value: getMessage('CLIENT_NOT_CONFIGURED'),
      writable: false,
    });
    return error;
  }
}
