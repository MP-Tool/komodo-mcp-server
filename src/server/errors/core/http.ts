/**
 * HTTP Constants Module
 *
 * HTTP-specific constants and mappings:
 * - HTTP status codes enum
 * - Error code to HTTP status mapping
 *
 * @module server/errors/core/http
 */

import { ErrorCodes, type ErrorCodeType } from './index.js';

// ============================================================================
// HTTP Status Codes
// ============================================================================

/**
 * HTTP Status Codes used in the transport layer.
 *
 * Following RFC 9110 and common conventions.
 */
export const HttpStatus = {
  // ─────────────────────────────────────────────────────────────────────────
  // Success (2xx)
  // ─────────────────────────────────────────────────────────────────────────
  /** Request succeeded */
  OK: 200,
  /** Request accepted for processing */
  ACCEPTED: 202,
  /** Request succeeded with no content to return */
  NO_CONTENT: 204,

  // ─────────────────────────────────────────────────────────────────────────
  // Client Errors (4xx)
  // ─────────────────────────────────────────────────────────────────────────
  /** Malformed request syntax */
  BAD_REQUEST: 400,
  /** Authentication required */
  UNAUTHORIZED: 401,
  /** Access denied */
  FORBIDDEN: 403,
  /** Resource not found */
  NOT_FOUND: 404,
  /** HTTP method not allowed */
  METHOD_NOT_ALLOWED: 405,
  /** Media type not supported */
  UNSUPPORTED_MEDIA_TYPE: 415,
  /** Request could not be completed due to a conflict (RFC 9110) */
  CONFLICT: 409,
  /** Precondition Required (RFC 6585) */
  PRECONDITION_REQUIRED: 428,
  /** Too Many Requests (Rate Limiting - RFC 6585) */
  TOO_MANY_REQUESTS: 429,
  /** Client Closed Request (nginx convention) */
  CLIENT_CLOSED_REQUEST: 499,

  // ─────────────────────────────────────────────────────────────────────────
  // Server Errors (5xx)
  // ─────────────────────────────────────────────────────────────────────────
  /** Internal server error */
  INTERNAL_SERVER_ERROR: 500,
  /** Feature not implemented */
  NOT_IMPLEMENTED: 501,
  /** Invalid response from upstream server */
  BAD_GATEWAY: 502,
  /** Service temporarily unavailable */
  SERVICE_UNAVAILABLE: 503,
  /** Upstream server timeout */
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatusType = (typeof HttpStatus)[keyof typeof HttpStatus];

// ============================================================================
// Error Code to HTTP Status Mapping
// ============================================================================

/**
 * Maps application error codes to HTTP status codes.
 *
 * This mapping is used by the base error class to automatically
 * derive HTTP status codes from error codes when not explicitly specified.
 */
export const ErrorCodeToHttpStatus: Partial<Record<ErrorCodeType, HttpStatusType>> & Record<string, HttpStatusType> = {
  // Client errors (4xx)
  [ErrorCodes.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.INVALID_REQUEST]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ErrorCodes.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorCodes.NOT_FOUND]: HttpStatus.NOT_FOUND,

  // Server errors (5xx)
  [ErrorCodes.CONFIGURATION_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCodes.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCodes.API_ERROR]: HttpStatus.BAD_GATEWAY,
  [ErrorCodes.CONNECTION_ERROR]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCodes.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCodes.TIMEOUT_ERROR]: HttpStatus.GATEWAY_TIMEOUT,
  [ErrorCodes.REGISTRY_ERROR]: HttpStatus.NOT_FOUND,

  // Operation errors
  [ErrorCodes.OPERATION_CANCELLED]: HttpStatus.CLIENT_CLOSED_REQUEST,
  [ErrorCodes.OPERATION_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,

  // App-specific
  [ErrorCodes.API_CLIENT_NOT_CONFIGURED]: HttpStatus.PRECONDITION_REQUIRED,
  [ErrorCodes.API_AUTHENTICATION_ERROR]: HttpStatus.UNAUTHORIZED,
};

/**
 * Get HTTP status code for an error code.
 *
 * @param code - The application error code
 * @returns HTTP status code (defaults to 500 if not mapped)
 */
export function getHttpStatusForErrorCode(code: ErrorCodeType): HttpStatusType {
  return ErrorCodeToHttpStatus[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
}
