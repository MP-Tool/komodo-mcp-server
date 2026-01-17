/**
 * Connection Error Classes
 *
 * Generic connection errors for the MCP framework.
 * Application-specific connection errors should extend these classes.
 *
 * @module server/errors/categories/connection
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AppError } from '../core/base.js';
import { ErrorCodes } from '../core/error-codes.js';
import { HttpStatus } from '../core/http.js';
import type { BaseErrorOptions } from '../core/types.js';
import { getFrameworkMessage } from '../core/messages.js';

// ============================================================================
// Connection Error
// ============================================================================

/**
 * Generic error thrown when connection to an API server fails.
 *
 * This is a framework-level error. For application-specific connection errors
 * with custom messages, extend this class in your app/errors/ module.
 *
 * @example
 * ```typescript
 * // Framework usage
 * throw FrameworkConnectionError.failed('http://api.example.com');
 * throw FrameworkConnectionError.timeout('http://api.example.com', 5000);
 *
 * // App-specific extension
 * class KomodoConnectionError extends FrameworkConnectionError {
 *   static komodoServerDown(url: string): KomodoConnectionError {
 *     return new KomodoConnectionError(
 *       `Komodo server at ${url} is not responding`,
 *       url,
 *       { recoveryHint: 'Ensure Komodo Core is running.' }
 *     );
 *   }
 * }
 * ```
 */
export class FrameworkConnectionError extends AppError {
  /** The target URL/address that connection was attempted to */
  readonly target: string;

  constructor(message: string, target: string, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(message, {
      code: ErrorCodes.CONNECTION_ERROR,
      statusCode: options.statusCode ?? HttpStatus.BAD_GATEWAY,
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        target,
      },
    });

    this.target = target;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a ConnectionError for a generic failed connection.
   */
  static failed(target: string, reason?: string): FrameworkConnectionError {
    const baseMessage = getFrameworkMessage('CONNECTION_FAILED');
    const message = reason ? `${baseMessage}: ${reason}` : `${baseMessage} to '${target}'`;

    return new FrameworkConnectionError(message, target, {
      recoveryHint: `Check that the server at '${target}' is running and accessible.`,
    });
  }

  /**
   * Create a ConnectionError for a refused connection.
   */
  static refused(target: string): FrameworkConnectionError {
    return new FrameworkConnectionError(getFrameworkMessage('CONNECTION_REFUSED'), target, {
      recoveryHint: `Ensure the server is running at '${target}' and accepting connections.`,
    });
  }

  /**
   * Create a ConnectionError for a connection timeout.
   *
   * @param target - The target URL/address
   * @param timeoutMs - Optional timeout duration in milliseconds
   */
  static timeout(target: string, timeoutMs?: number): FrameworkConnectionError {
    const baseMessage = getFrameworkMessage('CONNECTION_TIMEOUT');
    const message = timeoutMs ? `${baseMessage} (after ${timeoutMs}ms)` : baseMessage;

    return new FrameworkConnectionError(message, target, {
      statusCode: HttpStatus.GATEWAY_TIMEOUT,
      recoveryHint: `Connection to '${target}' timed out. Check network connectivity.`,
      context: timeoutMs ? { timeoutMs } : undefined,
    });
  }

  /**
   * Create a ConnectionError for connection lost.
   */
  static lost(target: string): FrameworkConnectionError {
    return new FrameworkConnectionError(getFrameworkMessage('CONNECTION_LOST'), target, {
      recoveryHint: `The connection to '${target}' was lost. Reconnecting may help.`,
    });
  }

  /**
   * Create a ConnectionError for connection reset.
   */
  static reset(target: string): FrameworkConnectionError {
    return new FrameworkConnectionError(getFrameworkMessage('CONNECTION_RESET'), target, {
      recoveryHint: `The connection to '${target}' was reset by the server. Try again.`,
    });
  }

  /**
   * Create a ConnectionError for a failed health check.
   *
   * @param reason - The reason the health check failed
   * @param target - Optional target URL (defaults to 'unknown')
   */
  static healthCheckFailed(reason: string, target = 'unknown'): FrameworkConnectionError {
    return new FrameworkConnectionError(`Health check failed: ${reason}`, target, {
      recoveryHint: 'The server is reachable but not healthy. Check server logs for details.',
      context: { reason },
    });
  }
}
