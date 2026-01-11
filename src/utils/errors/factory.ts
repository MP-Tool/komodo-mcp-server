/**
 * Error Factory Module
 *
 * Provides factory functions for consistent error creation.
 * Use these functions when you need to create errors with
 * proper context and consistent messaging.
 *
 * ## Usage Patterns
 *
 * 1. **Standard Messages**: Use factory methods for common errors
 * 2. **Custom Context**: Pass context when additional info is needed
 * 3. **Error Wrapping**: Use wrap functions for unknown errors
 *
 * @example
 * ```typescript
 * import { ErrorFactory } from './factory.js';
 *
 * // API errors
 * throw ErrorFactory.api.endpointError('/read/ListContainers', 'Timeout');
 * throw ErrorFactory.api.connectionTimeout('http://localhost:9120');
 *
 * // Validation errors
 * throw ErrorFactory.validation.fieldRequired('server');
 *
 * // Operation errors
 * throw ErrorFactory.operation.cancelled('listContainers');
 *
 * // MCP errors
 * throw ErrorFactory.mcp.sessionNotFound();
 * ```
 *
 * @module errors/factory
 */

import { ApiError, ConnectionError, AuthenticationError, NotFoundError } from './categories/api.js';
import { ValidationError, ConfigurationError } from './categories/validation.js';
import { OperationError, OperationCancelledError, ClientNotConfiguredError } from './categories/operation.js';
import { McpProtocolError, SessionError, TransportError } from './categories/mcp.js';
import { InternalError, RegistryError } from './categories/system.js';
import { AppError } from './core/base.js';

// ============================================================================
// API Error Factory
// ============================================================================

/**
 * Factory for API-related errors.
 */
export const ApiErrorFactory = {
  /** Create a generic API error */
  generic: (message: string) => new ApiError(message),

  /** Create an endpoint error */
  endpointError: ApiError.endpointError,

  /** Create an invalid response error */
  invalidResponse: ApiError.invalidResponse,

  /** Create a parse error */
  parseError: ApiError.parseError,

  /** Create an error with status */
  withStatus: ApiError.withStatus,

  /** Create a connection timeout error */
  connectionTimeout: (url?: string, timeoutMs?: number) => ConnectionError.timeout(url, timeoutMs),

  /** Create a connection refused error */
  connectionRefused: ConnectionError.refused,

  /** Create a connection failed error */
  connectionFailed: ConnectionError.failedToConnect,

  /** Create an auth failure error */
  authFailed: () => new AuthenticationError(),

  /** Create an invalid credentials error */
  invalidCredentials: AuthenticationError.invalidCredentials,

  /** Create a login failed error */
  loginFailed: AuthenticationError.loginFailed,

  /** Create a resource not found error */
  notFound: (resourceType: string, resourceId: string) => new NotFoundError(resourceType, resourceId),

  /** Create a server not found error */
  serverNotFound: NotFoundError.server,

  /** Create a container not found error */
  containerNotFound: NotFoundError.container,

  /** Create a stack not found error */
  stackNotFound: NotFoundError.stack,

  /** Create a deployment not found error */
  deploymentNotFound: NotFoundError.deployment,
};

// ============================================================================
// Validation Error Factory
// ============================================================================

/**
 * Factory for validation-related errors.
 */
export const ValidationErrorFactory = {
  /** Create a generic validation error */
  generic: (message: string) => new ValidationError(message),

  /** Create from Zod error */
  fromZod: ValidationError.fromZodError,

  /** Create a field required error */
  fieldRequired: ValidationError.fieldRequired,

  /** Create a field invalid error */
  fieldInvalid: ValidationError.fieldInvalid,

  /** Create a field type error */
  fieldType: ValidationError.fieldTypeMismatch,

  /** Create a field min error */
  fieldMin: ValidationError.fieldMin,

  /** Create a field max error */
  fieldMax: ValidationError.fieldMax,

  /** Create a field pattern error */
  fieldPattern: ValidationError.fieldPattern,

  /** Create a missing env var error */
  missingEnvVar: ConfigurationError.missingEnvVar,

  /** Create an invalid env var error */
  invalidEnvVar: ConfigurationError.invalidEnvVar,

  /** Create a config invalid error */
  configInvalid: ConfigurationError.invalid,
};

// ============================================================================
// Operation Error Factory
// ============================================================================

/**
 * Factory for operation-related errors.
 */
export const OperationErrorFactory = {
  /** Create a generic operation error */
  generic: (operation: string, message: string) => new OperationError(operation, message),

  /** Create an operation failed error */
  failed: OperationError.failed,

  /** Create an operation timeout error */
  timeout: OperationError.timeout,

  /** Create an operation not supported error */
  notSupported: OperationError.notSupported,

  /** Create a cancelled error */
  cancelled: (operation: string) => new OperationCancelledError(operation),

  /** Create a client not configured error */
  clientNotConfigured: (tool: string) => new ClientNotConfiguredError(tool),

  /** Create a generic client not configured error */
  clientNotConfiguredGeneric: ClientNotConfiguredError.generic,
};

// ============================================================================
// MCP Error Factory
// ============================================================================

/**
 * Factory for MCP protocol errors.
 */
export const McpErrorFactory = {
  /** Create an invalid JSON error */
  invalidJson: McpProtocolError.invalidJson,

  /** Create an invalid JSON-RPC error */
  invalidJsonRpc: McpProtocolError.invalidJsonRpc,

  /** Create a missing method error */
  missingMethod: McpProtocolError.missingMethod,

  /** Create an invalid batch error */
  invalidBatch: McpProtocolError.invalidBatch,

  /** Create an invalid content type error */
  invalidContentType: McpProtocolError.invalidContentType,

  /** Create a missing accept error */
  missingAccept: McpProtocolError.missingAccept,

  /** Create a request cancelled error */
  requestCancelled: McpProtocolError.requestCancelled,

  /** Create a session required error */
  sessionRequired: SessionError.required,

  /** Create a session not found error */
  sessionNotFound: SessionError.notFound,

  /** Create a session expired error */
  sessionExpired: SessionError.expired,

  /** Create a too many sessions error */
  tooManySessions: SessionError.tooMany,

  /** Create a transport closed error */
  transportClosed: TransportError.closed,

  /** Create an unsupported transport error */
  unsupportedTransport: TransportError.unsupported,
};

// ============================================================================
// System Error Factory
// ============================================================================

/**
 * Factory for system/internal errors.
 */
export const SystemErrorFactory = {
  /** Create a generic internal error */
  internal: (message?: string) => new InternalError(message),

  /** Create an internal error with ID */
  internalWithId: InternalError.withId,

  /** Create an unexpected error */
  unexpected: InternalError.unexpected,

  /** Create a not implemented error */
  notImplemented: InternalError.notImplemented,

  /** Create a service unavailable error */
  serviceUnavailable: InternalError.serviceUnavailable,

  /** Create a duplicate registry error */
  registryDuplicate: RegistryError.duplicate,

  /** Create a registry not found error */
  registryNotFound: RegistryError.notFound,

  /** Create a tool not available error */
  toolNotAvailable: RegistryError.toolNotAvailable,

  /** Create a tool requires connection error */
  toolRequiresConnection: RegistryError.toolRequiresConnection,
};

// ============================================================================
// Combined Error Factory
// ============================================================================

/**
 * Combined error factory with all categories.
 *
 * @example
 * ```typescript
 * import { ErrorFactory } from './factory.js';
 *
 * throw ErrorFactory.api.serverNotFound('my-server');
 * throw ErrorFactory.validation.fieldRequired('name');
 * throw ErrorFactory.operation.cancelled('listContainers');
 * throw ErrorFactory.mcp.sessionNotFound();
 * throw ErrorFactory.system.unexpected();
 * ```
 */
export const ErrorFactory = {
  /** API error factories */
  api: ApiErrorFactory,

  /** Validation error factories */
  validation: ValidationErrorFactory,

  /** Operation error factories */
  operation: OperationErrorFactory,

  /** MCP error factories */
  mcp: McpErrorFactory,

  /** System error factories */
  system: SystemErrorFactory,

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Functions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Wrap any error as a AppError.
   */
  wrap: AppError.wrap,

  /**
   * Wrap error with additional context.
   */
  wrapWithContext: AppError.wrapWithContext,

  /**
   * Check if error is a AppError.
   */
  isAppError: AppError.isAppError,

  /**
   * Check if error is a cancellation.
   */
  isCancellation: AppError.isCancellation,
};
