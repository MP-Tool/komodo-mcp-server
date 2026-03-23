/**
 * Application Error Factory
 *
 * Centralized error creation extending the framework factory with Komodo-specific errors.
 *
 * @module errors/factory
 */

import { FrameworkErrorFactory } from "mcp-server-framework";
import { type ZodError } from "zod";
import { ApiError, ConnectionError, AuthenticationError, NotFoundError, ClientNotConfiguredError } from "./classes.js";
import { getAppMessage } from "./messages.js";

export const AppErrorFactory = {
  // Framework errors (delegated)
  mcp: FrameworkErrorFactory.mcp,
  session: FrameworkErrorFactory.session,
  transport: FrameworkErrorFactory.transport,
  validation: {
    ...FrameworkErrorFactory.validation,
    fromZodError: (error: ZodError, message?: string) => FrameworkErrorFactory.validation.fromZodError(error, message),
  },
  configuration: FrameworkErrorFactory.configuration,
  operation: FrameworkErrorFactory.operation,
  cancellation: FrameworkErrorFactory.cancellation,
  internal: FrameworkErrorFactory.internal,
  registry: FrameworkErrorFactory.registry,
  normalize: FrameworkErrorFactory.normalize,
  isAppError: FrameworkErrorFactory.isAppError,

  // Komodo-specific errors
  api: {
    requestFailed: (reason?: string) => ApiError.requestFailed(reason),
    fromResponse: (status: number, message: string, endpoint?: string) =>
      ApiError.fromResponse(status, message, endpoint),
    invalidResponse: (reason?: string) => ApiError.invalidResponse(reason),
    parseError: (cause?: Error) => ApiError.parseError(cause),
    custom: (message: string, options?: { endpoint?: string; apiStatusCode?: number }) =>
      new ApiError(message, options),
  },

  connection: {
    failed: (target: string, reason?: string) => ConnectionError.failed(target, reason),
    refused: (target: string) => ConnectionError.refused(target),
    timeout: (target: string) => ConnectionError.timeout(target),
    custom: (message: string, target: string) => new ConnectionError(message, target),
  },

  auth: {
    failed: (reason?: string) => AuthenticationError.failed(reason),
    invalidCredentials: () => AuthenticationError.invalidCredentials(),
    tokenExpired: () => AuthenticationError.tokenExpired(),
    tokenInvalid: () => AuthenticationError.tokenInvalid(),
    unauthorized: () => AuthenticationError.unauthorized(),
    forbidden: () => AuthenticationError.forbidden(),
    custom: (message: string) => new AuthenticationError(message),
  },

  notFound: {
    resource: (resource: string, type?: string) => NotFoundError.resource(resource, type),
    server: (server: string) => NotFoundError.server(server),
    container: (container: string) => NotFoundError.container(container),
    stack: (stack: string) => NotFoundError.stack(stack),
    deployment: (deployment: string) => NotFoundError.deployment(deployment),
  },

  client: {
    notConfigured: () => ClientNotConfiguredError.notConfigured(),
    notConnected: () => ClientNotConfiguredError.notConnected(),
    invalidConfiguration: (reason: string) => ClientNotConfiguredError.invalidConfiguration(reason),
    custom: (message: string) => new ClientNotConfiguredError(message),
  },

  getMessage: getAppMessage,
} as const;

export type AppErrorFactoryType = typeof AppErrorFactory;
