/**
 * API Error Classes
 *
 * Errors related to Komodo API operations:
 * - ApiError: General API failures
 * - ConnectionError: Connection issues to Komodo server
 * - AuthenticationError: Authentication failures
 *
 * @module app/errors/api
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AppError, ErrorCodes, type BaseErrorOptions, HttpStatus } from '../framework.js';
import { getAppMessage } from './messages.js';

// ============================================================================
// API Error
// ============================================================================

/**
 * Error thrown when a Komodo API request fails.
 *
 * @example
 * ```typescript
 * throw new ApiError('API request failed', {
 *   statusCode: 500,
 *   endpoint: '/api/servers'
 * });
 *
 * // Using factory methods
 * throw ApiError.requestFailed('Server returned 500');
 * throw ApiError.fromResponse(response);
 * ```
 */
export class ApiError extends AppError {
  /** The API endpoint that was called */
  readonly endpoint?: string;

  /** The HTTP status code from the API */
  readonly apiStatusCode?: number;

  constructor(
    message: string,
    options: Omit<BaseErrorOptions, 'code'> & {
      endpoint?: string;
      apiStatusCode?: number;
    } = {},
  ) {
    super(message, {
      code: ErrorCodes.API_ERROR,
      statusCode: options.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        endpoint: options.endpoint,
        apiStatusCode: options.apiStatusCode,
      },
    });

    this.endpoint = options.endpoint;
    this.apiStatusCode = options.apiStatusCode;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an ApiError for a failed request.
   */
  static requestFailed(reason?: string): ApiError {
    const message = reason
      ? getAppMessage('API_REQUEST_FAILED_REASON', { reason })
      : getAppMessage('API_REQUEST_FAILED');

    return new ApiError(message, {
      recoveryHint: 'Check the API endpoint and try again.',
    });
  }

  /**
   * Create an ApiError from an API response.
   */
  static fromResponse(status: number, responseMessage: string, endpoint?: string): ApiError {
    return new ApiError(
      getAppMessage('API_REQUEST_FAILED_STATUS', { status: String(status), message: responseMessage }),
      {
        apiStatusCode: status,
        endpoint,
        statusCode: status >= 500 ? HttpStatus.BAD_GATEWAY : HttpStatus.BAD_REQUEST,
        recoveryHint:
          status >= 500 ? 'The API server encountered an error. Try again later.' : 'Check the request parameters.',
      },
    );
  }

  /**
   * Create an ApiError for invalid response.
   */
  static invalidResponse(reason?: string): ApiError {
    const message = reason
      ? `${getAppMessage('API_RESPONSE_INVALID')}: ${reason}`
      : getAppMessage('API_RESPONSE_INVALID');

    return new ApiError(message, {
      recoveryHint: 'The API returned an unexpected response format.',
    });
  }

  /**
   * Create an ApiError for parse errors.
   */
  static parseError(cause?: Error): ApiError {
    return new ApiError(getAppMessage('API_RESPONSE_PARSE_ERROR'), {
      cause,
      recoveryHint: 'The API response could not be parsed. Check the API version compatibility.',
    });
  }
}

// ============================================================================
// Connection Error
// ============================================================================

/**
 * Error thrown when connection to Komodo server fails.
 *
 * @example
 * ```typescript
 * throw ConnectionError.failed('http://localhost:9120', 'ECONNREFUSED');
 * throw ConnectionError.timeout('http://localhost:9120');
 * ```
 */
export class ConnectionError extends AppError {
  /** The target that connection was attempted to */
  readonly target: string;

  constructor(message: string, target: string, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(message, {
      code: ErrorCodes.CONNECTION_ERROR,
      statusCode: HttpStatus.BAD_GATEWAY,
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
   * Create a ConnectionError for a failed connection.
   */
  static failed(target: string, reason?: string): ConnectionError {
    const message = reason
      ? `${getAppMessage('CONNECTION_FAILED', { target })}: ${reason}`
      : getAppMessage('CONNECTION_FAILED', { target });

    return new ConnectionError(message, target, {
      recoveryHint: `Check that the Komodo server at '${target}' is running and accessible.`,
    });
  }

  /**
   * Create a ConnectionError for a refused connection.
   */
  static refused(target: string): ConnectionError {
    return new ConnectionError(getAppMessage('CONNECTION_REFUSED', { target }), target, {
      recoveryHint: `Ensure the Komodo server is running at '${target}' and accepting connections.`,
    });
  }

  /**
   * Create a ConnectionError for a timeout.
   *
   * @param target - The target URL/address
   * @param timeoutMs - Optional timeout duration in milliseconds for context
   */
  static timeout(target: string, timeoutMs?: number): ConnectionError {
    const message = timeoutMs
      ? `${getAppMessage('CONNECTION_TIMEOUT', { target })} (after ${timeoutMs}ms)`
      : getAppMessage('CONNECTION_TIMEOUT', { target });

    return new ConnectionError(message, target, {
      statusCode: HttpStatus.GATEWAY_TIMEOUT,
      recoveryHint: `Connection to '${target}' timed out. Check network connectivity.`,
      context: timeoutMs ? { timeoutMs } : undefined,
    });
  }

  /**
   * Create a ConnectionError for health check failure.
   */
  static healthCheckFailed(reason: string, cause?: Error): ConnectionError {
    return new ConnectionError(getAppMessage('CONNECTION_HEALTH_CHECK_FAILED', { reason }), 'health-check', {
      cause,
      recoveryHint: 'Health check failed. Ensure the Komodo server is fully operational.',
    });
  }
}

// ============================================================================
// Authentication Error
// ============================================================================

/**
 * Error thrown when authentication fails.
 *
 * @example
 * ```typescript
 * throw AuthenticationError.invalidCredentials();
 * throw AuthenticationError.tokenExpired();
 * throw AuthenticationError.unauthorized();
 * ```
 */
export class AuthenticationError extends AppError {
  constructor(message: string, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(message, {
      code: ErrorCodes.API_AUTHENTICATION_ERROR,
      statusCode: options.statusCode || HttpStatus.UNAUTHORIZED,
      mcpCode: ErrorCode.InvalidRequest,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: options.context,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an AuthenticationError for a general failure.
   */
  static failed(reason?: string): AuthenticationError {
    const message = reason ? getAppMessage('AUTH_FAILED_REASON', { reason }) : getAppMessage('AUTH_FAILED');

    return new AuthenticationError(message, {
      recoveryHint: 'Check your credentials and try again.',
    });
  }

  /**
   * Create an AuthenticationError for invalid credentials.
   */
  static invalidCredentials(): AuthenticationError {
    return new AuthenticationError(getAppMessage('AUTH_INVALID_CREDENTIALS'), {
      recoveryHint: 'Verify the username and password are correct.',
    });
  }

  /**
   * Create an AuthenticationError for expired token.
   */
  static tokenExpired(): AuthenticationError {
    return new AuthenticationError(getAppMessage('AUTH_TOKEN_EXPIRED'), {
      recoveryHint: 'Reconfigure the client to obtain a new token.',
    });
  }

  /**
   * Create an AuthenticationError for invalid token.
   */
  static tokenInvalid(): AuthenticationError {
    return new AuthenticationError(getAppMessage('AUTH_TOKEN_INVALID'), {
      recoveryHint: 'Reconfigure the client with valid credentials.',
    });
  }

  /**
   * Create an AuthenticationError for unauthorized access.
   */
  static unauthorized(): AuthenticationError {
    return new AuthenticationError(getAppMessage('AUTH_UNAUTHORIZED'), {
      recoveryHint: 'Ensure you have the required permissions.',
    });
  }

  /**
   * Create an AuthenticationError for forbidden access.
   */
  static forbidden(): AuthenticationError {
    return new AuthenticationError(getAppMessage('AUTH_FORBIDDEN'), {
      statusCode: HttpStatus.FORBIDDEN,
      recoveryHint: 'You do not have permission to perform this action.',
    });
  }

  /**
   * Create an AuthenticationError for login failure.
   */
  static loginFailed(status: number, statusText: string): AuthenticationError {
    return new AuthenticationError(getAppMessage('AUTH_LOGIN_FAILED', { status: String(status), statusText }), {
      recoveryHint: 'Login failed. Check your credentials and ensure the Komodo server is accessible.',
    });
  }

  /**
   * Create an AuthenticationError when login succeeds but no token is returned.
   */
  static noToken(): AuthenticationError {
    return new AuthenticationError(getAppMessage('AUTH_NO_TOKEN'), {
      recoveryHint: 'Server did not return an authentication token. This may be a server configuration issue.',
    });
  }

  /**
   * Create an AuthenticationError for missing token.
   */
  static tokenMissing(): AuthenticationError {
    return new AuthenticationError(getAppMessage('AUTH_TOKEN_MISSING'), {
      recoveryHint: 'Authentication token is missing. Use komodo_configure to authenticate first.',
    });
  }
}
