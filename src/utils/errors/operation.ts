/**
 * Operation Error Classes
 *
 * Errors related to tool/resource operations.
 *
 * @module errors/operation
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { KomodoError, KomodoErrorCode } from './base.js';
import { JsonRpcErrorCode } from '../../config/index.js';

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
export class OperationCancelledError extends KomodoError {
  /** The operation that was cancelled */
  readonly operation: string;

  constructor(
    operation: string,
    options: {
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(`Operation '${operation}' was cancelled`, {
      code: KomodoErrorCode.OPERATION_CANCELLED,
      statusCode: 499, // Client Closed Request (nginx convention)
      mcpCode: JsonRpcErrorCode.REQUEST_CANCELLED as unknown as ErrorCode,
      cause: options.cause,
      context: {
        ...options.context,
        operation,
      },
    });

    this.operation = operation;
  }

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

/**
 * Error thrown when an operation fails.
 *
 * @example
 * ```typescript
 * throw new OperationError('startContainer', 'Container is already running', {
 *   container: 'nginx',
 *   server: 'my-server'
 * });
 * ```
 */
export class OperationError extends KomodoError {
  /** The operation that failed */
  readonly operation: string;

  constructor(
    operation: string,
    message: string,
    options: {
      statusCode?: number;
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      code: KomodoErrorCode.OPERATION_FAILED,
      statusCode: options.statusCode ?? 500,
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      context: {
        ...options.context,
        operation,
      },
    });

    this.operation = operation;
  }
}

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
export class ClientNotConfiguredError extends KomodoError {
  /** The tool that requires a client */
  readonly tool: string;

  constructor(
    tool: string,
    options: {
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(`Tool '${tool}' requires a Komodo connection. Use 'komodo_configure' to connect first.`, {
      code: KomodoErrorCode.CONFIGURATION_ERROR,
      statusCode: 503, // Service Unavailable
      mcpCode: ErrorCode.InvalidRequest,
      context: {
        ...options.context,
        tool,
      },
    });

    this.tool = tool;
  }
}
