/**
 * Errors Module
 *
 * Centralized error handling system with:
 * - Typed error codes for programmatic handling
 * - Centralized message registry with interpolation
 * - Category-based error organization
 * - MCP/HTTP/JSON-RPC error code mapping
 * - Factory pattern for consistent error creation
 *
 * ## Error Hierarchy
 *
 * ```
 * AppError (base)
 * ├── API Errors
 * │   ├── ApiError           - Komodo API communication errors
 * │   ├── ConnectionError    - Connection/timeout errors
 * │   ├── AuthenticationError - Auth failures
 * │   └── NotFoundError      - Resource not found
 * ├── Validation Errors
 * │   ├── ValidationError    - Input validation errors
 * │   └── ConfigurationError - Configuration errors
 * ├── Operation Errors
 * │   ├── OperationError     - Generic operation failures
 * │   ├── OperationCancelledError - Cancelled operations
 * │   └── ClientNotConfiguredError - Missing Komodo client
 * ├── MCP Errors
 * │   ├── McpProtocolError   - Protocol violations
 * │   ├── SessionError       - Session management errors
 * │   └── TransportError     - Transport layer errors
 * └── System Errors
 *     ├── InternalError      - Internal server errors
 *     └── RegistryError      - Registry errors
 * ```
 *
 * ## Usage Examples
 *
 * ```typescript
 * // Using error classes directly
 * import { NotFoundError, ValidationError } from './errors/index.js';
 * throw new NotFoundError('Server', 'my-server');
 * throw ValidationError.fieldRequired('name');
 *
 * // Using ErrorFactory for consistency
 * import { ErrorFactory } from './errors/index.js';
 * throw ErrorFactory.api.serverNotFound('my-server');
 * throw ErrorFactory.validation.fieldRequired('name');
 *
 * // Using getMessage for custom messages
 * import { getMessage } from './errors/index.js';
 * const msg = getMessage('RESOURCE_NOT_FOUND', {
 *   resourceType: 'Server',
 *   resourceId: 'my-server'
 * });
 * ```
 *
 * @module errors
 */

// ============================================================================
// Core - Types, Constants, Messages, Base Class
// ============================================================================

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
  // Base error class
  AppError,
} from './core/index.js';

// ============================================================================
// Categories - Specialized Error Classes
// ============================================================================

export {
  // API Errors
  ApiError,
  ConnectionError,
  AuthenticationError,
  NotFoundError,
  // Validation Errors
  ValidationError,
  ConfigurationError,
  // Operation Errors
  OperationError,
  OperationCancelledError,
  ClientNotConfiguredError,
  // MCP Errors
  McpProtocolError,
  SessionError,
  TransportError,
  // System Errors
  InternalError,
  RegistryError,
} from './categories/index.js';

// ============================================================================
// Factory - Consistent Error Creation
// ============================================================================

export {
  ErrorFactory,
  ApiErrorFactory,
  ValidationErrorFactory,
  OperationErrorFactory,
  McpErrorFactory,
  SystemErrorFactory,
} from './factory.js';
