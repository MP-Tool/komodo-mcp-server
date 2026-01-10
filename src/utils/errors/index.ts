/**
 * Errors Module
 *
 * Custom error classes for type-safe error handling throughout the application.
 *
 * ## Error Hierarchy
 *
 * ```
 * KomodoError (base)
 * ├── ApiError           - Komodo API communication errors
 * ├── ConnectionError    - Connection/timeout errors
 * ├── AuthenticationError - Auth failures
 * ├── NotFoundError      - Resource not found
 * ├── ValidationError    - Input validation errors
 * ├── ConfigurationError - Configuration errors
 * ├── OperationCancelledError - Cancelled operations
 * ├── OperationError     - Generic operation failures
 * └── ClientNotConfiguredError - Missing Komodo client
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   KomodoError,
 *   ApiError,
 *   ValidationError,
 *   NotFoundError
 * } from './errors/index.js';
 *
 * // Throwing errors
 * throw new NotFoundError('Server', 'my-server');
 *
 * // Catching and handling
 * try {
 *   await doSomething();
 * } catch (error) {
 *   if (error instanceof NotFoundError) {
 *     // Handle not found
 *   } else if (KomodoError.isKomodoError(error)) {
 *     // Handle any Komodo error
 *     logger.error('Operation failed', error.toJSON());
 *   } else {
 *     // Wrap unknown errors
 *     throw KomodoError.wrap(error);
 *   }
 * }
 * ```
 *
 * @module errors
 */

// Base error
export { KomodoError, KomodoErrorCode, type KomodoErrorCodeType, type SerializedError } from './base.js';

// API errors
export { ApiError, ConnectionError, AuthenticationError, NotFoundError } from './api.js';

// Validation errors
export { ValidationError, ConfigurationError, type ValidationIssue } from './validation.js';

// Operation errors
export { OperationCancelledError, OperationError, ClientNotConfiguredError } from './operation.js';
