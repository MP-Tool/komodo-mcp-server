/**
 * Framework Errors Module
 *
 * This module provides the error system for the MCP server framework.
 * Application-specific errors should be created in app/errors/ by extending
 * these base classes.
 *
 * @module server/errors
 *
 * @example
 * ```typescript
 * import {
 *   FrameworkErrorFactory,
 *   AppError,
 *   ValidationError,
 *   ErrorCodes,
 *   getFrameworkMessage,
 * } from './server/errors/index.js';
 *
 * // Using the factory
 * throw FrameworkErrorFactory.validation.fieldRequired('name');
 *
 * // Using classes directly
 * throw new ValidationError('Invalid input', { field: 'email' });
 *
 * // Checking error types
 * if (FrameworkErrorFactory.isAppError(error)) {
 *   console.log(error.code, error.statusCode);
 * }
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────
// Core
// ─────────────────────────────────────────────────────────────────────────

export {
  // Error Codes & Categories
  ErrorCodes,
  ErrorCategory,
  type ErrorCodeType,
  type ErrorCategoryType,
  // HTTP
  HttpStatus,
  ErrorCodeToHttpStatus,
  getHttpStatusForErrorCode,
  type HttpStatusType,
  // JSON-RPC
  JsonRpcErrorCode,
  isSpecDefinedJsonRpcError,
  isServerDefinedJsonRpcError,
  isValidJsonRpcErrorCode,
  type JsonRpcErrorCodeType,
  // Validation
  VALIDATION_LIMITS,
  SENSITIVE_FIELD_PATTERNS,
  REDACTED_VALUE,
  isSensitiveField,
  redactIfSensitive,
  // Base Error
  AppError,
  // Messages
  FrameworkMessages,
  getFrameworkMessage,
  interpolate,
  TransportErrorMessage,
} from './core/index.js';

export type {
  // Types
  SerializedError,
  BaseErrorOptions,
  ValidationErrorOptions,
  ValidationIssue,
  // Messages
  TransportErrorMessageKey,
} from './core/index.js';

// ─────────────────────────────────────────────────────────────────────────
// Error Categories
// ─────────────────────────────────────────────────────────────────────────

export {
  // MCP Protocol
  McpProtocolError,
  SessionError,
  TransportError,
  // Validation
  ValidationError,
  ConfigurationError,
  // System
  InternalError,
  RegistryError,
  // Operation
  OperationError,
  OperationCancelledError,
  // Connection
  FrameworkConnectionError,
} from './categories/index.js';

// ─────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────

export { FrameworkErrorFactory, type FrameworkErrorFactoryType } from './factory.js';
