/**
 * Framework Error Factory
 *
 * Centralized error creation for the MCP framework layer.
 * Application-specific errors should extend these in app/errors/.
 *
 * @module server/errors/factory
 */

import { ZodError } from 'zod';
import { AppError, getFrameworkMessage } from './core/index.js';
import {
  McpProtocolError,
  SessionError,
  TransportError,
  ValidationError,
  ConfigurationError,
  InternalError,
  RegistryError,
  OperationError,
  OperationCancelledError,
} from './categories/index.js';

/**
 * Framework Error Factory
 *
 * Provides static methods for creating framework-level errors.
 * This factory is generic and can be extended by application code.
 *
 * @example
 * ```typescript
 * // MCP errors
 * throw FrameworkErrorFactory.mcp.invalidRequest('Missing params');
 * throw FrameworkErrorFactory.session.expired('sess-123');
 *
 * // Validation errors
 * throw FrameworkErrorFactory.validation.fromZodError(zodError);
 * throw FrameworkErrorFactory.validation.fieldRequired('name');
 *
 * // Operation errors
 * throw FrameworkErrorFactory.operation.failed('deploy', 'timeout');
 * ```
 */
export const FrameworkErrorFactory = {
  // ─────────────────────────────────────────────────────────────────────────
  // MCP Protocol Errors
  // ─────────────────────────────────────────────────────────────────────────

  mcp: {
    /** Create an invalid request error */
    invalidRequest: (reason: string) => McpProtocolError.invalidRequest(reason),

    /** Create a method not found error */
    methodNotFound: (method: string) => McpProtocolError.methodNotFound(method),

    /** Create an invalid params error */
    invalidParams: (reason: string) => McpProtocolError.invalidParams(reason),

    /** Create a parse error */
    parseError: (reason: string) => McpProtocolError.parseError(reason),

    /** Create a custom MCP error */
    custom: (message: string, code?: number) => new McpProtocolError(message, code),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Session Errors
  // ─────────────────────────────────────────────────────────────────────────

  session: {
    /** Create a session not found error */
    notFound: (sessionId: string) => SessionError.sessionNotFound(sessionId),

    /** Create a session expired error */
    expired: (sessionId: string) => SessionError.sessionExpired(sessionId),

    /** Create a session limit reached error */
    limitReached: (maxSessions: number) => SessionError.sessionLimitReached(maxSessions),

    /** Create an invalid session state error */
    invalidState: (sessionId: string, currentState: string, expectedState: string) =>
      SessionError.invalidState(sessionId, currentState, expectedState),

    /** Create a custom session error */
    custom: (message: string, sessionId?: string) => new SessionError(message, { sessionId }),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Transport Errors
  // ─────────────────────────────────────────────────────────────────────────

  transport: {
    /** Create a connection failed error */
    connectionFailed: (reason: string) => TransportError.connectionFailed(reason),

    /** Create a connection closed error */
    connectionClosed: (reason?: string) => TransportError.connectionClosed(reason),

    /** Create an invalid header error */
    invalidHeader: (header: string, reason: string) => TransportError.invalidHeader(header, reason),

    /** Create a protocol mismatch error */
    protocolMismatch: (expected: string, received: string) => TransportError.protocolMismatch(expected, received),

    /** Create a rate limited error */
    rateLimited: (retryAfterSeconds?: number) => TransportError.rateLimited(retryAfterSeconds),

    /** Create a DNS rebinding error */
    dnsRebinding: (host: string) => TransportError.dnsRebinding(host),

    /** Create a custom transport error */
    custom: (message: string, transportType?: 'http' | 'sse' | 'stdio' | 'streamable-http') =>
      new TransportError(message, { transportType }),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Validation Errors
  // ─────────────────────────────────────────────────────────────────────────

  validation: {
    /** Create from a Zod error */
    fromZodError: (error: ZodError, message?: string) => ValidationError.fromZodError(error, message),

    /** Create a field required error */
    fieldRequired: (field: string) => ValidationError.fieldRequired(field),

    /** Create a field invalid error */
    fieldInvalid: (field: string, value?: unknown) => ValidationError.fieldInvalid(field, value),

    /** Create a type mismatch error */
    fieldTypeMismatch: (field: string, expectedType: string) => ValidationError.fieldTypeMismatch(field, expectedType),

    /** Create a min constraint error */
    fieldMin: (field: string, min: number) => ValidationError.fieldMin(field, min),

    /** Create a max constraint error */
    fieldMax: (field: string, max: number) => ValidationError.fieldMax(field, max),

    /** Create a pattern mismatch error */
    fieldPattern: (field: string) => ValidationError.fieldPattern(field),

    /** Create a custom validation error */
    custom: (message: string, field?: string) => new ValidationError(message, { field }),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration Errors
  // ─────────────────────────────────────────────────────────────────────────

  configuration: {
    /** Create a missing env var error */
    missingEnvVar: (varName: string) => ConfigurationError.missingEnvVar(varName),

    /** Create an invalid env var error */
    invalidEnvVar: (varName: string, reason: string) => ConfigurationError.invalidEnvVar(varName, reason),

    /** Create an invalid configuration error */
    invalid: (message: string) => ConfigurationError.invalid(message),

    /** Create a custom configuration error */
    custom: (message: string, configKey?: string) => new ConfigurationError(message, { configKey }),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Operation Errors
  // ─────────────────────────────────────────────────────────────────────────

  operation: {
    /** Create a failed operation error */
    failed: (operation: string, reason?: string) => OperationError.failed(operation, reason),

    /** Create a timeout error */
    timeout: (operation: string, timeoutMs: number) => OperationError.timeout(operation, timeoutMs),

    /** Create an unavailable error */
    unavailable: (operation: string) => OperationError.unavailable(operation),

    /** Create a custom operation error */
    custom: (message: string, operation?: string) => new OperationError(message, { operation }),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Cancellation Errors
  // ─────────────────────────────────────────────────────────────────────────

  cancellation: {
    /** Create from a cancelled request */
    fromRequest: (requestId: string | number, reason?: string) =>
      OperationCancelledError.fromRequest(requestId, reason),

    /** Create from an AbortSignal */
    fromAbortSignal: (signal: AbortSignal, requestId?: string | number) =>
      OperationCancelledError.fromAbortSignal(signal, requestId),

    /** Create a custom cancellation error */
    custom: (message: string, requestId?: string | number) => new OperationCancelledError(message, requestId),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // System Errors
  // ─────────────────────────────────────────────────────────────────────────

  internal: {
    /** Wrap an unknown error */
    wrap: (error: unknown, context?: string) => InternalError.wrap(error, context),

    /** Create an unexpected state error */
    unexpectedState: (description: string) => InternalError.unexpectedState(description),

    /** Create a not implemented error */
    notImplemented: (feature: string) => InternalError.notImplemented(feature),

    /** Create a custom internal error */
    custom: (message: string) => new InternalError(message),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Registry Errors
  // ─────────────────────────────────────────────────────────────────────────

  registry: {
    /** Tool not found */
    toolNotFound: (name: string) => RegistryError.toolNotFound(name),

    /** Duplicate tool */
    duplicateTool: (name: string) => RegistryError.duplicateTool(name),

    /** Resource not found */
    resourceNotFound: (name: string) => RegistryError.resourceNotFound(name),

    /** Duplicate resource */
    duplicateResource: (name: string) => RegistryError.duplicateResource(name),

    /** Prompt not found */
    promptNotFound: (name: string) => RegistryError.promptNotFound(name),

    /** Duplicate prompt */
    duplicatePrompt: (name: string) => RegistryError.duplicatePrompt(name),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if an error is an AppError (framework or app error)
   */
  isAppError: (error: unknown): error is AppError => {
    return error instanceof AppError;
  },

  /**
   * Get a message from the framework message catalog
   */
  getMessage: getFrameworkMessage,

  /**
   * Normalize any error to an AppError
   */
  normalize: (error: unknown, fallbackMessage?: string): AppError => {
    if (error instanceof AppError) {
      return error;
    }

    const message = error instanceof Error ? error.message : fallbackMessage || 'An unexpected error occurred';

    return new InternalError(message, {
      cause: error instanceof Error ? error : undefined,
    });
  },
} as const;

// Type for the factory
export type FrameworkErrorFactoryType = typeof FrameworkErrorFactory;
