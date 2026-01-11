/**
 * Error Core Module - Barrel Export
 *
 * Re-exports all core error types, constants, messages, and base class.
 *
 * @module errors/core
 */

// Types
export {
  // Error codes
  ErrorCodes,
  type ErrorCodeType,
  // Error categories
  ErrorCategory,
  type ErrorCategoryType,
  // HTTP status mapping
  ErrorCodeToHttpStatus,
  // Serialization types
  type SerializedError,
  // Error options
  type BaseErrorOptions,
  type ApiErrorOptions,
  type ConnectionErrorOptions,
  type ValidationErrorOptions,
  type ValidationIssue,
  type OperationErrorOptions,
} from './types.js';

// Constants
export {
  // JSON-RPC error codes
  JsonRpcErrorCode,
  type JsonRpcErrorCodeType,
  // HTTP status codes
  HttpStatus,
  type HttpStatusType,
  // Validation limits
  VALIDATION_LIMITS,
  // Sensitive field detection
  SENSITIVE_FIELD_PATTERNS,
  isSensitiveField,
} from './constants.js';

// Messages
export {
  // Message definitions
  ErrorMessages,
  type MessageKey,
  // Message interpolation
  getMessage,
  interpolate,
  type MessageParams,
  // Message categories
  MessageCategories,
  type MessageCategoryType,
  // Transport error messages
  TransportErrorMessage,
  type TransportErrorMessageKey,
} from './messages.js';

// Base error class
export { AppError } from './base.js';
