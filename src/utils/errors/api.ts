/**
 * API Error Classes
 *
 * Errors related to Komodo API communication.
 *
 * @module errors/api
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { KomodoError, KomodoErrorCode } from './base.js';

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
 * ```
 */
export class ApiError extends KomodoError {
  /** The API endpoint that was called */
  readonly endpoint?: string;

  /** The HTTP method used */
  readonly method?: string;

  /** Response status code from the API */
  readonly responseStatus?: number;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      endpoint?: string;
      method?: string;
      responseStatus?: number;
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      code: KomodoErrorCode.API_ERROR,
      statusCode: options.statusCode ?? 502, // Bad Gateway for upstream errors
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
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
}

/**
 * Error thrown when connection to Komodo fails.
 *
 * @example
 * ```typescript
 * throw new ConnectionError('Unable to connect to Komodo', {
 *   url: 'http://localhost:9120',
 *   cause: originalError
 * });
 * ```
 */
export class ConnectionError extends KomodoError {
  /** The URL that was attempted */
  readonly url?: string;

  /** Whether this is a timeout */
  readonly isTimeout: boolean;

  constructor(
    message: string,
    options: {
      url?: string;
      isTimeout?: boolean;
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    const isTimeout = options.isTimeout ?? false;

    super(message, {
      code: isTimeout ? KomodoErrorCode.TIMEOUT_ERROR : KomodoErrorCode.CONNECTION_ERROR,
      statusCode: isTimeout ? 504 : 503, // Gateway Timeout or Service Unavailable
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      context: {
        ...options.context,
        url: options.url,
        isTimeout,
      },
    });

    this.url = options.url;
    this.isTimeout = isTimeout;
  }
}

/**
 * Error thrown when authentication fails.
 *
 * @example
 * ```typescript
 * throw new AuthenticationError('Invalid credentials');
 * ```
 */
export class AuthenticationError extends KomodoError {
  constructor(
    message = 'Authentication failed',
    options: {
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      code: KomodoErrorCode.UNAUTHORIZED,
      statusCode: 401,
      mcpCode: ErrorCode.InvalidRequest,
      cause: options.cause,
      context: options.context,
    });
  }
}

/**
 * Error thrown when a resource is not found.
 *
 * @example
 * ```typescript
 * throw new NotFoundError('Server', 'my-server');
 * ```
 */
export class NotFoundError extends KomodoError {
  /** Type of resource that was not found */
  readonly resourceType: string;

  /** Identifier of the resource */
  readonly resourceId: string;

  constructor(
    resourceType: string,
    resourceId: string,
    options: {
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(`${resourceType} '${resourceId}' not found`, {
      code: KomodoErrorCode.NOT_FOUND,
      statusCode: 404,
      mcpCode: ErrorCode.InvalidRequest,
      cause: options.cause,
      context: {
        ...options.context,
        resourceType,
        resourceId,
      },
    });

    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}
