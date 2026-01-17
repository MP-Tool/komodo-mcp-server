/**
 * Error Core Module - Barrel Export
 *
 * Re-exports all core error system components:
 * - Error codes and categories
 * - HTTP status codes and mappings
 * - JSON-RPC error codes
 * - Validation constants and utilities
 * - Type definitions
 * - Base error class
 * - Framework messages
 *
 * @module server/errors/core
 */

// ─────────────────────────────────────────────────────────────────────────
// Error Codes & Categories
// ─────────────────────────────────────────────────────────────────────────
export { ErrorCodes, ErrorCategory, type ErrorCodeType, type ErrorCategoryType } from './error-codes.js';

// ─────────────────────────────────────────────────────────────────────────
// HTTP Constants & Mappings
// ─────────────────────────────────────────────────────────────────────────
export { HttpStatus, ErrorCodeToHttpStatus, getHttpStatusForErrorCode, type HttpStatusType } from './http.js';

// ─────────────────────────────────────────────────────────────────────────
// JSON-RPC Constants
// ─────────────────────────────────────────────────────────────────────────
export {
  JsonRpcErrorCode,
  isSpecDefinedJsonRpcError,
  isServerDefinedJsonRpcError,
  isValidJsonRpcErrorCode,
  type JsonRpcErrorCodeType,
} from './json-rpc.js';

// ─────────────────────────────────────────────────────────────────────────
// Validation Constants & Utilities
// ─────────────────────────────────────────────────────────────────────────
export {
  VALIDATION_LIMITS,
  SENSITIVE_FIELD_PATTERNS,
  REDACTED_VALUE,
  isSensitiveField,
  redactIfSensitive,
} from './constants.js';

// ─────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────
export type { SerializedError, BaseErrorOptions, ValidationErrorOptions, ValidationIssue } from './types.js';

// ─────────────────────────────────────────────────────────────────────────
// Base Error Class
// ─────────────────────────────────────────────────────────────────────────
export { AppError } from './base.js';

// ─────────────────────────────────────────────────────────────────────────
// Framework Messages
// ─────────────────────────────────────────────────────────────────────────
export {
  FrameworkMessages,
  getFrameworkMessage,
  interpolate,
  TransportErrorMessage,
  type TransportErrorMessageKey,
} from './messages.js';
