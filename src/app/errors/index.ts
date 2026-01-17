/**
 * Application Errors Module
 *
 * Komodo-specific errors that extend the framework error system.
 *
 * @module app/errors
 *
 * @example
 * ```typescript
 * import {
 *   AppErrorFactory,
 *   ApiError,
 *   NotFoundError,
 *   ClientNotConfiguredError,
 *   getAppMessage,
 * } from './app/errors/index.js';
 *
 * // Using the factory (recommended)
 * throw AppErrorFactory.api.requestFailed('Server returned 500');
 * throw AppErrorFactory.notFound.server('my-server');
 * throw AppErrorFactory.client.notConfigured();
 *
 * // Using classes directly
 * throw ApiError.fromResponse(500, 'Internal error', '/api/servers');
 *
 * // Access to framework errors through the factory
 * throw AppErrorFactory.validation.fieldRequired('name');
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────────────────────

export { AppMessages, getAppMessage, type AppMessageKey, type MessageParams } from './messages.js';

// ─────────────────────────────────────────────────────────────────────────
// Error Classes
// ─────────────────────────────────────────────────────────────────────────

// API Errors
export { ApiError, ConnectionError, AuthenticationError } from './api.js';

// Resource Errors
export { NotFoundError, ClientNotConfiguredError } from './resource.js';

// ─────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────

export { AppErrorFactory, type AppErrorFactoryType } from './factory.js';

// ─────────────────────────────────────────────────────────────────────────
// Re-exports from Framework
// ─────────────────────────────────────────────────────────────────────────

// Re-export base error and types for convenience
export {
  AppError,
  ErrorCodes,
  type ErrorCodeType,
  type BaseErrorOptions,
  HttpStatus,
  getFrameworkMessage,
  FrameworkErrorFactory,
} from '../framework.js';
