/**
 * Application Error Factory
 *
 * Centralized error creation for the Komodo application layer.
 * Extends the framework error factory with Komodo-specific errors.
 *
 * @module app/errors/factory
 */

import { FrameworkErrorFactory } from '../framework.js';
import { ApiError, ConnectionError, AuthenticationError } from './api.js';
import { NotFoundError, ClientNotConfiguredError } from './resource.js';
import { getAppMessage, type AppMessageKey } from './messages.js';

/**
 * Application Error Factory
 *
 * Extends the framework factory with Komodo-specific errors.
 *
 * @example
 * ```typescript
 * // API errors
 * throw AppErrorFactory.api.requestFailed('Server error');
 * throw AppErrorFactory.api.fromResponse(500, 'Internal error', '/api/servers');
 *
 * // Connection errors
 * throw AppErrorFactory.connection.failed('http://localhost:9120', 'ECONNREFUSED');
 *
 * // Authentication errors
 * throw AppErrorFactory.auth.invalidCredentials();
 *
 * // Not found errors
 * throw AppErrorFactory.notFound.server('my-server');
 *
 * // Client configuration
 * throw AppErrorFactory.client.notConfigured();
 *
 * // Also has access to all framework errors
 * throw AppErrorFactory.validation.fieldRequired('name');
 * ```
 */
export const AppErrorFactory = {
  // ─────────────────────────────────────────────────────────────────────────
  // Framework Errors (delegated)
  // ─────────────────────────────────────────────────────────────────────────

  /** MCP protocol errors */
  mcp: FrameworkErrorFactory.mcp,

  /** Session errors */
  session: FrameworkErrorFactory.session,

  /** Transport errors */
  transport: FrameworkErrorFactory.transport,

  /** Validation errors */
  validation: FrameworkErrorFactory.validation,

  /** Configuration errors (generic) */
  configuration: FrameworkErrorFactory.configuration,

  /** Operation errors */
  operation: FrameworkErrorFactory.operation,

  /** Cancellation errors */
  cancellation: FrameworkErrorFactory.cancellation,

  /** Internal errors */
  internal: FrameworkErrorFactory.internal,

  /** Registry errors */
  registry: FrameworkErrorFactory.registry,

  /** Normalize any error to AppError */
  normalize: FrameworkErrorFactory.normalize,

  /** Check if error is AppError */
  isAppError: FrameworkErrorFactory.isAppError,

  // ─────────────────────────────────────────────────────────────────────────
  // App-Specific Errors
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * API errors
   */
  api: {
    /** Create a request failed error */
    requestFailed: (reason?: string) => ApiError.requestFailed(reason),

    /** Create from API response */
    fromResponse: (status: number, message: string, endpoint?: string) =>
      ApiError.fromResponse(status, message, endpoint),

    /** Create an invalid response error */
    invalidResponse: (reason?: string) => ApiError.invalidResponse(reason),

    /** Create a parse error */
    parseError: (cause?: Error) => ApiError.parseError(cause),

    /** Create a custom API error */
    custom: (message: string, options?: { endpoint?: string; apiStatusCode?: number }) =>
      new ApiError(message, options),
  },

  /**
   * Connection errors
   */
  connection: {
    /** Create a connection failed error */
    failed: (target: string, reason?: string) => ConnectionError.failed(target, reason),

    /** Create a connection refused error */
    refused: (target: string) => ConnectionError.refused(target),

    /** Create a connection timeout error */
    timeout: (target: string) => ConnectionError.timeout(target),

    /** Create a custom connection error */
    custom: (message: string, target: string) => new ConnectionError(message, target),
  },

  /**
   * Authentication errors
   */
  auth: {
    /** Create a general authentication failure */
    failed: (reason?: string) => AuthenticationError.failed(reason),

    /** Create an invalid credentials error */
    invalidCredentials: () => AuthenticationError.invalidCredentials(),

    /** Create a token expired error */
    tokenExpired: () => AuthenticationError.tokenExpired(),

    /** Create a token invalid error */
    tokenInvalid: () => AuthenticationError.tokenInvalid(),

    /** Create an unauthorized error */
    unauthorized: () => AuthenticationError.unauthorized(),

    /** Create a forbidden error */
    forbidden: () => AuthenticationError.forbidden(),

    /** Create a custom authentication error */
    custom: (message: string) => new AuthenticationError(message),
  },

  /**
   * Not found errors
   */
  notFound: {
    /** Create a generic resource not found error */
    resource: (resource: string, type?: string) => NotFoundError.resource(resource, type),

    /** Create a server not found error */
    server: (server: string) => NotFoundError.server(server),

    /** Create a container not found error */
    container: (container: string) => NotFoundError.container(container),

    /** Create a stack not found error */
    stack: (stack: string) => NotFoundError.stack(stack),

    /** Create a deployment not found error */
    deployment: (deployment: string) => NotFoundError.deployment(deployment),
  },

  /**
   * Client configuration errors
   */
  client: {
    /** Create a client not configured error */
    notConfigured: () => ClientNotConfiguredError.notConfigured(),

    /** Create a client not connected error */
    notConnected: () => ClientNotConfiguredError.notConnected(),

    /** Create an invalid configuration error */
    invalidConfiguration: (reason: string) => ClientNotConfiguredError.invalidConfiguration(reason),

    /** Create a custom client error */
    custom: (message: string) => new ClientNotConfiguredError(message),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Message Access
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a framework message
   */
  getFrameworkMessage: FrameworkErrorFactory.getMessage,

  /**
   * Get an app message
   */
  getMessage: getAppMessage,
} as const;

// Type for the factory
export type AppErrorFactoryType = typeof AppErrorFactory;
