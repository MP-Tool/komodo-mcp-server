/**
 * API Error Classes
 *
 * Errors related to Komodo API communication:
 * - ApiError: Generic API failures
 * - ConnectionError: Network/connection failures
 * - AuthenticationError: Authentication failures
 * - NotFoundError: Resource not found
 *
 * @module errors/categories/api
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AppError } from '../core/base.js';
import { ErrorCodes, type ApiErrorOptions, type ConnectionErrorOptions, type BaseErrorOptions } from '../core/types.js';
import { getMessage } from '../core/messages.js';

// ============================================================================
// API Error
// ============================================================================

/**
 * Error thrown when a Komodo API request fails.
 *
 * @example
 * ```typescript
 * throw new ApiError('Failed to list containers', {
 *   statusCode: 500,
 *   endpoint: '/read/ListContainers',
 *   cause: originalError
 * });
 *
 * // Or using getMessage
 * throw ApiError.endpointError('/read/ListContainers', 'Timeout');
 * ```
 */
export class ApiError extends AppError {
  /** The API endpoint that was called */
  readonly endpoint?: string;

  /** The HTTP method used */
  readonly method?: string;

  /** Response status code from the API */
  readonly responseStatus?: number;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, {
      code: ErrorCodes.API_ERROR,
      statusCode: options.statusCode ?? 502, // Bad Gateway for upstream errors
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        endpoint: options.endpoint,
        method: options.method,
        responseStatus: options.responseStatus,
      },
    });

    this.endpoint = options.endpoint;
    this.method = options.method;
    this.responseStatus = options.responseStatus;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an ApiError for a failed endpoint call.
   */
  static endpointError(endpoint: string, errorMessage: string, options?: Omit<ApiErrorOptions, 'endpoint'>): ApiError {
    return new ApiError(getMessage('API_ENDPOINT_ERROR', { endpoint, message: errorMessage }), {
      ...options,
      endpoint,
      recoveryHint: 'Check the Komodo server logs for more details. The endpoint may be temporarily unavailable.',
    });
  }

  /**
   * Create an ApiError for an invalid API response.
   */
  static invalidResponse(options?: ApiErrorOptions): ApiError {
    return new ApiError(getMessage('API_RESPONSE_INVALID'), {
      ...options,
      recoveryHint: 'The Komodo server returned an unexpected response format. Check server version compatibility.',
    });
  }

  /**
   * Create an ApiError for a response parse error.
   */
  static parseError(options?: ApiErrorOptions): ApiError {
    return new ApiError(getMessage('API_RESPONSE_PARSE_ERROR'), {
      ...options,
      recoveryHint: 'The API response could not be parsed. This may indicate a server error or network issue.',
    });
  }

  /**
   * Create an ApiError with status code.
   */
  static withStatus(status: number, options?: ApiErrorOptions): ApiError {
    return new ApiError(getMessage('API_REQUEST_FAILED_WITH_STATUS', { status: String(status) }), {
      ...options,
      responseStatus: status,
      recoveryHint:
        status >= 500
          ? 'The Komodo server encountered an error. Check server logs and try again.'
          : 'The request was rejected. Verify your parameters and permissions.',
    });
  }
}

// ============================================================================
// Connection Error
// ============================================================================

/**
 * Error thrown when connection to Komodo fails.
 *
 * @example
 * ```typescript
 * throw new ConnectionError('Unable to connect to Komodo', {
 *   url: 'http://localhost:9120',
 *   cause: originalError
 * });
 *
 * // Or using factory methods
 * throw ConnectionError.timeout('http://localhost:9120', 5000);
 * ```
 */
export class ConnectionError extends AppError {
  /** The URL that was attempted */
  readonly url?: string;

  /** Whether this is a timeout */
  readonly isTimeout: boolean;

  constructor(message: string, options: ConnectionErrorOptions = {}) {
    const isTimeout = options.isTimeout ?? false;

    super(message, {
      code: isTimeout ? ErrorCodes.TIMEOUT_ERROR : ErrorCodes.CONNECTION_ERROR,
      statusCode: isTimeout ? 504 : 503, // Gateway Timeout or Service Unavailable
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        url: options.url,
        isTimeout,
      },
    });

    this.url = options.url;
    this.isTimeout = isTimeout;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a ConnectionError for a timeout.
   */
  static timeout(url?: string, timeoutMs?: number): ConnectionError {
    const message = timeoutMs
      ? getMessage('CONNECTION_TIMEOUT_MS', { timeout: String(timeoutMs) })
      : getMessage('CONNECTION_TIMEOUT');

    return new ConnectionError(message, {
      url,
      isTimeout: true,
      recoveryHint: 'Check if the Komodo server is running and accessible. Try increasing the timeout value.',
    });
  }

  /**
   * Create a ConnectionError for connection refused.
   */
  static refused(url?: string, cause?: Error): ConnectionError {
    return new ConnectionError(getMessage('CONNECTION_REFUSED'), {
      url,
      cause,
      recoveryHint: 'The server refused the connection. Verify the server is running and the URL/port are correct.',
    });
  }

  /**
   * Create a ConnectionError for connection reset.
   */
  static reset(url?: string, cause?: Error): ConnectionError {
    return new ConnectionError(getMessage('CONNECTION_RESET'), {
      url,
      cause,
      recoveryHint: 'The connection was reset by the server. This may indicate server restart or network issues.',
    });
  }

  /**
   * Create a ConnectionError for DNS failure.
   */
  static dnsFailure(host: string, cause?: Error): ConnectionError {
    return new ConnectionError(getMessage('CONNECTION_DNS_FAILED', { host }), {
      cause,
      recoveryHint: 'DNS lookup failed. Check if the hostname is correct and DNS is configured properly.',
    });
  }

  /**
   * Create a ConnectionError with URL.
   */
  static failedToConnect(url: string, cause?: Error): ConnectionError {
    return new ConnectionError(getMessage('CONNECTION_FAILED_URL', { url }), {
      url,
      cause,
      recoveryHint: 'Failed to establish connection. Verify the URL is correct and the server is reachable.',
    });
  }

  /**
   * Create a ConnectionError for health check failure.
   */
  static healthCheckFailed(reason: string, cause?: Error): ConnectionError {
    return new ConnectionError(getMessage('CONNECTION_HEALTH_CHECK_FAILED', { reason }), {
      cause,
      recoveryHint: 'Health check failed. Ensure the Komodo server is fully operational and healthy.',
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
 * throw new AuthenticationError();
 * // Or with custom message
 * throw new AuthenticationError('Invalid credentials');
 * // Or using factory methods
 * throw AuthenticationError.invalidCredentials();
 * ```
 */
export class AuthenticationError extends AppError {
  constructor(message: string = getMessage('AUTH_FAILED'), options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(message, {
      code: ErrorCodes.UNAUTHORIZED,
      statusCode: 401,
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
   * Create an AuthenticationError for invalid credentials.
   */
  static invalidCredentials(): AuthenticationError {
    return new AuthenticationError(getMessage('AUTH_INVALID_CREDENTIALS'), {
      recoveryHint: 'Check your username and password. Credentials are case-sensitive.',
    });
  }

  /**
   * Create an AuthenticationError for expired token.
   */
  static tokenExpired(): AuthenticationError {
    return new AuthenticationError(getMessage('AUTH_TOKEN_EXPIRED'), {
      recoveryHint: 'Your session has expired. Please re-authenticate using komodo_configure.',
    });
  }

  /**
   * Create an AuthenticationError for missing token.
   */
  static tokenMissing(): AuthenticationError {
    return new AuthenticationError(getMessage('AUTH_TOKEN_MISSING'), {
      recoveryHint: 'Authentication token is missing. Use komodo_configure to authenticate first.',
    });
  }

  /**
   * Create an AuthenticationError for invalid token.
   */
  static tokenInvalid(): AuthenticationError {
    return new AuthenticationError(getMessage('AUTH_TOKEN_INVALID'), {
      recoveryHint: 'The authentication token is invalid. Please re-authenticate using komodo_configure.',
    });
  }

  /**
   * Create an AuthenticationError for login failure.
   */
  static loginFailed(status: number, statusText: string): AuthenticationError {
    return new AuthenticationError(getMessage('AUTH_LOGIN_FAILED', { status: String(status), statusText }), {
      recoveryHint: 'Login failed. Check your credentials and ensure the Komodo server is accessible.',
    });
  }

  /**
   * Create an AuthenticationError when login succeeds but no token is returned.
   */
  static noToken(): AuthenticationError {
    return new AuthenticationError(getMessage('AUTH_NO_TOKEN'), {
      recoveryHint: 'Server did not return an authentication token. This may be a server configuration issue.',
    });
  }
}

// ============================================================================
// Not Found Error
// ============================================================================

/**
 * Error thrown when a resource is not found.
 *
 * @example
 * ```typescript
 * throw new NotFoundError('Server', 'my-server');
 *
 * // Or using factory methods
 * throw NotFoundError.server('my-server');
 * throw NotFoundError.container('nginx');
 * ```
 */
export class NotFoundError extends AppError {
  /** Type of resource that was not found */
  readonly resourceType: string;

  /** Identifier of the resource */
  readonly resourceId: string;

  constructor(resourceType: string, resourceId: string, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(getMessage('RESOURCE_NOT_FOUND', { resourceType, resourceId }), {
      code: ErrorCodes.NOT_FOUND,
      statusCode: 404,
      mcpCode: ErrorCode.InvalidRequest,
      cause: options.cause,
      recoveryHint:
        options.recoveryHint ??
        `Verify that the ${resourceType.toLowerCase()} '${resourceId}' exists and is accessible.`,
      context: {
        ...options.context,
        resourceType,
        resourceId,
      },
    });

    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a NotFoundError for a server.
   */
  static server(serverId: string): NotFoundError {
    return new NotFoundError('Server', serverId);
  }

  /**
   * Create a NotFoundError for a container.
   */
  static container(containerId: string): NotFoundError {
    return new NotFoundError('Container', containerId);
  }

  /**
   * Create a NotFoundError for a stack.
   */
  static stack(stackId: string): NotFoundError {
    return new NotFoundError('Stack', stackId);
  }

  /**
   * Create a NotFoundError for a deployment.
   */
  static deployment(deploymentId: string): NotFoundError {
    return new NotFoundError('Deployment', deploymentId);
  }
}
